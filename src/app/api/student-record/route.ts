import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

const prisma = new PrismaClient();

function normalizeDay(dateInput: string) {
  return new Date(`${dateInput}T12:00:00Z`);
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const term = searchParams.get("term");

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

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";
    const student = await prisma.student.findFirst({
      where: isAdmin
        ? { id: studentId }
        : {
            id: studentId,
            turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
          },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const [grades, absences] = await Promise.all([
      prisma.grade.findMany({
        where: {
          studentId: student.id,
          ...(term ? { term } : { createdAt: { gte: fromDate, lte: toDate } }),
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.absence.findMany({
        where: {
          studentId: student.id,
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
        justified: absence.justified,
        justificationTitle: absence.justificationTitle ?? "",
        justificationNotes: absence.justificationNotes ?? "",
        hasAttachment: Boolean(absence.attachmentUrl),
        attachmentName: absence.attachmentName,
        createdAt: absence.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Student record fetch error:", error);
    return NextResponse.json({ error: "Não foi possível carregar o registo do aluno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") {
    return NextResponse.json({ error: "Sem permissão para alterar registos." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const studentId = body.studentId ?? body.absences?.[0]?.studentId;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";
    const student = await prisma.student.findFirst({
      where: isAdmin
        ? { id: studentId }
        : {
            id: studentId,
            turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
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

        const createdGrade = await prisma.grade.create({
          data: {
            studentId,
            subject: entry.subject,
            value: numericValue,
            term: entry.term ?? "Semanal",
          },
        });

        await createActivityLog({
          actorId: session.user.id,
          actorName: describeActorName(session.user),
          action: "Registou nota",
          entity: "Grade",
          entityId: createdGrade.id,
          details: {
            studentId,
            subject: entry.subject,
            term: entry.term ?? "Semanal",
            value: numericValue,
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

        const existingSlot = await prisma.absence.findUnique({
          where: { studentId_dia_tempo: { studentId: entry.studentId, dia, tempo: entry.tempo } },
          select: { id: true, subject: true },
        });
        if (existingSlot && existingSlot.subject !== entry.subject) {
          return NextResponse.json({ error: "Cada aluno só pode ter uma falta por data e tempo lectivo, independentemente da disciplina." }, { status: 409 });
        }

        const savedAbsence = await prisma.absence.upsert({
          where: {
            studentId_dia_tempo: {
              studentId: entry.studentId,
              dia,
              tempo: entry.tempo,
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

        await createActivityLog({
          actorId: session.user.id,
          actorName: describeActorName(session.user),
          action: "Registou falta",
          entity: "Absence",
          entityId: savedAbsence.id,
          details: {
            studentId: entry.studentId,
            subject: entry.subject,
            dia: entry.dia,
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
    return NextResponse.json({ error: "Não foi possível guardar o registo do aluno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") return NextResponse.json({ error: "Sem permissão para alterar registos." }, { status: 403 });

  try {
    const body = await request.json();
    const type = body.type === "absence" ? "absence" : body.type === "grade" ? "grade" : "";
    const id = typeof body.id === "string" ? body.id : "";
    if (!type || !id) return NextResponse.json({ error: "Record type and id are required" }, { status: 400 });

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";

    if (type === "grade") {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 0 || value > 20) return NextResponse.json({ error: "Grade must be between 0 and 20" }, { status: 400 });
      const grade = await prisma.grade.findFirst({
        where: isAdmin
          ? { id }
          : { id, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
        include: { student: { include: { turma: { select: { subjects: { select: { name: true } } } } } } },
      });
      if (!grade) return NextResponse.json({ error: "Grade not found" }, { status: 404 });
      const subject = typeof body.subject === "string" ? body.subject : grade.subject;
      if (!grade.student.turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });
      const updated = await prisma.grade.update({ where: { id }, data: { value, subject, term: typeof body.term === "string" ? body.term : grade.term } });
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: "Atualizou a nota",
        entity: "Grade",
        entityId: updated.id,
        details: {
          studentId: grade.studentId,
          subject,
          value,
          term: typeof body.term === "string" ? body.term : grade.term,
        },
      });
      return NextResponse.json({ success: true, record: updated });
    }

      const absence = await prisma.absence.findFirst({
        where: { id, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
      });
    if (!absence) return NextResponse.json({ error: "Absence not found" }, { status: 404 });
    const subject = typeof body.subject === "string" ? body.subject : absence.subject;
    const dia = typeof body.dia === "string" ? normalizeDay(body.dia) : absence.dia;
    const tempo = typeof body.tempo === "string" ? body.tempo : absence.tempo;
    const conflictingAbsence = await prisma.absence.findFirst({
      where: { studentId: absence.studentId, dia, tempo, NOT: { id: absence.id } },
      select: { id: true },
    });
    if (conflictingAbsence) return NextResponse.json({ error: "Cada aluno só pode ter uma falta por data e tempo lectivo, independentemente da disciplina." }, { status: 409 });
    const faultType = body.faultType === "AUSENCIA_NA_SALA" ? "AUSENCIA_NA_SALA" : body.faultType === "FALTA_DE_MATERIAL" ? "FALTA_DE_MATERIAL" : absence.faultType;
    const updated = await prisma.absence.update({ where: { id }, data: { subject, dia, tempo, faultType, notes: typeof body.notes === "string" ? body.notes : absence.notes } });
    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Atualizou a falta",
      entity: "Absence",
      entityId: updated.id,
      details: {
        studentId: absence.studentId,
        subject,
        dia: dia.toISOString(),
        tempo,
        faultType,
        notes: typeof body.notes === "string" ? body.notes : absence.notes,
      },
    });
    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error("Student record update error:", error);
    return NextResponse.json({ error: "Não foi possível atualizar o registo do aluno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") return NextResponse.json({ error: "Sem permissão para alterar registos." }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    if (!id || (type !== "grade" && type !== "absence")) return NextResponse.json({ error: "Record type and id are required" }, { status: 400 });

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";

    if (type === "grade") {
      const grade = await prisma.grade.findFirst({
        where: isAdmin ? { id } : { id, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
      });
      if (!grade) return NextResponse.json({ error: "Grade not found" }, { status: 404 });
      await prisma.grade.delete({ where: { id } });
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: "Eliminou nota",
        entity: "Grade",
        entityId: id,
        details: {
          studentId: grade.studentId,
          subject: grade.subject,
          value: grade.value,
          term: grade.term,
        },
      });
    } else {
      const absence = await prisma.absence.findFirst({
        where: isAdmin ? { id } : { id, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
      });
      if (!absence) return NextResponse.json({ error: "Absence not found" }, { status: 404 });
      await prisma.absence.delete({ where: { id } });
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: "Eliminou falta",
        entity: "Absence",
        entityId: id,
        details: {
          studentId: absence.studentId,
          subject: absence.subject,
          dia: absence.dia.toISOString(),
          tempo: absence.tempo,
          faultType: absence.faultType,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student record delete error:", error);
    return NextResponse.json({ error: "Não foi possível eliminar o registo do aluno" }, { status: 500 });
  }
}
