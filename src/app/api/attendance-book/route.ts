import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

function normalizeDay(dateInput: string) {
  return new Date(`${dateInput}T12:00:00Z`);
}

async function getAuthorizedTurma(userId: string, turmaId: string) {
  return prisma.turma.findFirst({
    where: { id: turmaId, coordinator: { userId } },
    include: {
      subjects: { orderBy: { name: "asc" }, select: { name: true } },
      students: { orderBy: { name: "asc" }, select: { id: true, name: true, age: true } },
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const turmaId = searchParams.get("turmaId");
  const date = searchParams.get("date");
  const subject = searchParams.get("subject");

  if (!turmaId || !date || !subject) return NextResponse.json({ error: "Turma, date, and subject are required" }, { status: 400 });

  const turma = await getAuthorizedTurma(session.user.id, turmaId);
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });

  const dia = normalizeDay(date);
  const absences = await prisma.absence.findMany({
    where: { studentId: { in: turma.students.map((student) => student.id) }, subject, dia },
    select: { studentId: true, tempo: true, faultType: true, notes: true },
  });

  return NextResponse.json({
    students: turma.students,
    subjects: turma.subjects.map((entry) => entry.name),
    absences,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
    const date = typeof body.date === "string" ? body.date : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const tempo = typeof body.tempo === "string" ? body.tempo : "1º tempo";
    const faultType = body.faultType === "AUSENCIA_NA_SALA" ? "AUSENCIA_NA_SALA" : "FALTA_DE_MATERIAL";
    const studentIds: string[] = Array.isArray(body.studentIds)
      ? body.studentIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!turmaId || !date || !subject) return NextResponse.json({ error: "Turma, date, and subject are required" }, { status: 400 });

    const turma = await getAuthorizedTurma(session.user.id, turmaId);
    if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
    if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });

    const turmaStudentIds = new Set(turma.students.map((student) => student.id));
    const dia = normalizeDay(date);
    const validStudentIds: string[] = [...new Set(studentIds)].filter((studentId) => turmaStudentIds.has(studentId));

    await prisma.$transaction(async (transaction) => {
      await transaction.absence.deleteMany({
        where: { studentId: { in: turma.students.map((student) => student.id) }, subject, dia },
      });

      if (validStudentIds.length) {
        await transaction.absence.createMany({
          data: validStudentIds.map((studentId) => ({ studentId, subject, dia, tempo, faultType, notes: "" })),
        });
      }
    });

    return NextResponse.json({ success: true, saved: validStudentIds.length });
  } catch (error) {
    console.error("Attendance book save error:", error);
    return NextResponse.json({ error: "Failed to save attendance book" }, { status: 500 });
  }
}
