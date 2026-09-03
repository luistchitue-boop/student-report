import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

const prisma = new PrismaClient();

function isValidDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime());
}

async function getAuthorizedTurma(userId: string, turmaId: string, userRole?: string) {
  const isAdmin = userRole === "ADMIN";

  return prisma.turma.findFirst({
    where: isAdmin ? { id: turmaId } : { id: turmaId, teacherAssignments: { some: { teacher: { userId } } } },
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
  const turmaId = searchParams.get("turmaId") ?? "";
  const subject = searchParams.get("subject") ?? "";
  const weekStart = searchParams.get("weekStart") ?? "";
  const weekEnd = searchParams.get("weekEnd") ?? "";
  const exportMode = searchParams.get("export") === "true";

  if (!turmaId || !subject || !weekStart || !weekEnd || !isValidDate(weekStart) || !isValidDate(weekEnd)) {
    return NextResponse.json({ error: "Turma, subject, and a valid weekly interval are required" }, { status: 400 });
  }

  const turma = await getAuthorizedTurma(session.user.id, turmaId);
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });

  const term = `Semanal:${weekStart}:${weekEnd}`;
  const startDate = new Date(`${weekStart}T00:00:00Z`);
  const endDate = new Date(`${weekEnd}T23:59:59.999Z`);
  const grades = await prisma.grade.findMany({
    where: exportMode
      ? { studentId: { in: turma.students.map((student) => student.id) }, subject, createdAt: { gte: startDate, lte: endDate } }
      : { studentId: { in: turma.students.map((student) => student.id) }, subject, term },
    select: { studentId: true, value: true },
  });

  return NextResponse.json({ students: turma.students, subjects: turma.subjects.map((entry) => entry.name), grades, alreadyRecorded: grades.length > 0 });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
    const weekEnd = typeof body.weekEnd === "string" ? body.weekEnd : "";
    const grades = Array.isArray(body.grades) ? body.grades : [];

    if (!turmaId || !subject || !weekStart || !weekEnd || !isValidDate(weekStart) || !isValidDate(weekEnd)) {
      return NextResponse.json({ error: "Turma, subject, and a valid weekly interval are required" }, { status: 400 });
    }

    const start = new Date(`${weekStart}T12:00:00Z`);
    const end = new Date(`${weekEnd}T12:00:00Z`);
    if (end.getTime() - start.getTime() !== 6 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "O intervalo semanal deve ter exatamente 7 dias." }, { status: 400 });
    }

    const turma = await getAuthorizedTurma(session.user.id, turmaId, session.user.role ?? "COORDENADOR");
    if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
    if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });

    const turmaStudentIds = new Set(turma.students.map((student) => student.id));
    const validGrades: Array<{ studentId: string; value: number }> = grades.flatMap((entry: { studentId?: unknown; value?: unknown }) => {
      if (typeof entry.studentId !== "string" || !turmaStudentIds.has(entry.studentId)) return [];
      const value = Number(entry.value);
      return Number.isFinite(value) && value >= 0 && value <= 20 ? [{ studentId: entry.studentId, value }] : [];
    });
    const term = `Semanal:${weekStart}:${weekEnd}`;

    const existingGradeCount = await prisma.grade.count({
      where: { studentId: { in: turma.students.map((student) => student.id) }, subject, term },
    });

    if (existingGradeCount > 0) {
      return NextResponse.json(
        {
          error: "Já existe uma mini pauta registada para esta disciplina no intervalo semanal selecionado. Não pode voltar a guardar o mesmo intervalo.",
        },
        { status: 409 }
      );
    }

    if (validGrades.length) {
      await prisma.grade.createMany({
        data: validGrades.map((entry) => ({ studentId: entry.studentId, subject, value: entry.value, term })),
      });
    }

    if (validGrades.length) {
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: "Registou notas",
        entity: "Grade",
        entityId: null,
        details: {
          turmaId,
          subject,
          term,
          studentIds: validGrades.map((entry) => entry.studentId),
          values: validGrades,
        },
      });
    }

    return NextResponse.json({ success: true, saved: validGrades.length });
  } catch (error) {
    console.error("Mini pauta save error:", error);
    return NextResponse.json({ error: "Não foi possível guardar a mini pauta" }, { status: 500 });
  }
}
