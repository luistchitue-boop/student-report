import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

function normalizeDay(dateInput: string) {
  return new Date(`${dateInput}T12:00:00Z`);
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    if (!from || !to) {
      return NextResponse.json({ error: "Date range is required" }, { status: 400 });
    }

    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const [grades, absences] = await Promise.all([
      prisma.grade.findMany({
        where: {
          studentId,
          createdAt: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.absence.findMany({
        where: {
          studentId,
          dia: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { dia: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      grades: grades.map((grade) => ({
        id: grade.id,
        studentId: grade.studentId,
        subject: grade.subject,
        value: grade.value,
        term: grade.term,
        createdAt: grade.createdAt.toISOString(),
      })),
      absences: absences.map((absence) => ({
        id: absence.id,
        studentId: absence.studentId,
        subject: absence.subject,
        dia: absence.dia.toISOString(),
        tempo: absence.tempo,
        faultType: absence.faultType,
        notes: absence.notes ?? "",
        createdAt: absence.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Student record fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch student record" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const studentId = body.studentId ?? body.absences?.[0]?.studentId;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        turma: { coordinator: { userId: session.user.id } },
      },
      select: { turma: { select: { subjects: { select: { name: true } } } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const subjectNames = new Set(student.turma.subjects.map((subject) => subject.name));

    if (body.grades) {
      const grades = Array.isArray(body.grades) ? body.grades : [];

      for (const entry of grades) {
        const rawValue = entry.value;
        const numericValue = Number(rawValue);

        if (!subjectNames.has(entry.subject) || rawValue === undefined || rawValue === null || rawValue === "" || Number.isNaN(numericValue) || numericValue < 0 || numericValue > 20) {
          continue;
        }

        await prisma.grade.create({
          data: {
            studentId,
            subject: entry.subject,
            value: numericValue,
            term: entry.term ?? "Semanal",
          },
        });
      }

      return NextResponse.json({ success: true, saved: grades.length });
    }

    if (body.absences) {
      const absences = Array.isArray(body.absences) ? body.absences : [];

      for (const entry of absences) {
        if (!entry.studentId || entry.studentId !== studentId || !subjectNames.has(entry.subject) || !entry.dia) {
          continue;
        }

        const dia = normalizeDay(entry.dia);
        const faultType = entry.faultType === "AUSENCIA_NA_SALA" ? "AUSENCIA_NA_SALA" : "FALTA_DE_MATERIAL";

        await prisma.absence.upsert({
          where: {
            studentId_subject_dia: {
              studentId: entry.studentId,
              subject: entry.subject,
              dia,
            },
          },
          update: {
            tempo: entry.tempo,
            faultType,
            notes: entry.notes ?? "",
            createdAt: new Date(),
          },
          create: {
            studentId: entry.studentId,
            subject: entry.subject,
            dia,
            tempo: entry.tempo,
            faultType,
            notes: entry.notes ?? "",
          },
        });
      }

      return NextResponse.json({ success: true, saved: absences.length });
    }

    return NextResponse.json({ error: "No valid payload provided" }, { status: 400 });
  } catch (error) {
    console.error("Student record save error:", error);
    return NextResponse.json({ error: "Failed to save student record" }, { status: 500 });
  }
}
