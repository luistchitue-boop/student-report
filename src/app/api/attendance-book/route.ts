import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog } from "@/lib/activity-log";

const prisma = new PrismaClient();

function normalizeDay(dateInput: string) {
  return new Date(`${dateInput}T12:00:00Z`);
}

async function getAuthorizedTurma(userId: string, turmaId: string, userRole?: string) {
  const isAdmin = userRole === "ADMIN";

  return prisma.turma.findFirst({
    where: isAdmin ? { id: turmaId } : { id: turmaId, coordinator: { userId } },
    include: {
      subjects: { orderBy: { name: "asc" }, select: { name: true } },
      students: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, age: true } },
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const turmaId = searchParams.get("turmaId");
  const date = searchParams.get("date");
  const subject = searchParams.get("subject");
  const tempo = searchParams.get("tempo");

  if (!turmaId || !date || !subject) return NextResponse.json({ error: "Turma, date, and subject are required" }, { status: 400 });

  const turma = await getAuthorizedTurma(session.user.id, turmaId);
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });

  const dia = normalizeDay(date);
  const absences = await prisma.absence.findMany({
    where: {
      studentId: { in: turma.students.map((student) => student.id) },
      subject,
      dia,
      ...(tempo ? { tempo } : {}),
    },
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
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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

    const turma = await getAuthorizedTurma(session.user.id, turmaId, session.user.role ?? "COORDENADOR");
    if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
    if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });

    const turmaStudentIds = new Set(turma.students.map((student) => student.id));
    const dia = normalizeDay(date);
    const validStudentIds: string[] = [...new Set(studentIds)].filter((studentId) => turmaStudentIds.has(studentId));

    const existingAbsences = await prisma.absence.findMany({
      where: {
        studentId: { in: validStudentIds },
        subject,
        dia,
        tempo,
      },
      select: { studentId: true },
    });

    const duplicatedStudentIds = new Set(existingAbsences.map((absence) => absence.studentId));
    if (duplicatedStudentIds.size > 0) {
      return NextResponse.json(
        {
          error: "Já existe uma falta para este aluno na mesma disciplina, no mesmo dia e no mesmo tempo lectivo.",
          duplicatedStudentIds: [...duplicatedStudentIds],
        },
        { status: 409 }
      );
    }

    const newStudentIds = validStudentIds.filter((studentId) => !duplicatedStudentIds.has(studentId));

    if (newStudentIds.length) {
      await prisma.absence.createMany({
        data: newStudentIds.map((studentId) => ({ studentId, subject, dia, tempo, faultType, notes: "" })),
      });

      await createActivityLog({
        actorId: session.user.id,
        actorName: session.user.name ?? session.user.email ?? "Utilizador",
        action: "Registou faltas",
        entity: "Absence",
        entityId: null,
        details: {
          turmaId,
          subject,
          dia: date,
          tempo,
          studentIds: newStudentIds,
          faultType,
        },
      });
    }

    return NextResponse.json({ success: true, saved: newStudentIds.length });
  } catch (error) {
    console.error("Attendance book save error:", error);
    return NextResponse.json({ error: "Não foi possível guardar o livro de ponto" }, { status: 500 });
  }
}
