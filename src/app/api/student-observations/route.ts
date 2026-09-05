import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

const prisma = new PrismaClient();

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentWeeklyPeriod(weekStart: Date) {
  const today = new Date();
  const currentPeriod = getWeeklyCoordinationPeriods(today.getFullYear()).find((period) => period.start <= today && period.end >= today);
  return currentPeriod ? formatPeriodDate(currentPeriod.start) === weekStart.toISOString().slice(0, 10) : false;
}

async function getAuthorizedStudent(studentId: string, session: { user: { id: string; role?: string | null } }) {
  const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";
  return prisma.student.findFirst({
    where: isAdmin
      ? { id: studentId }
      : { id: studentId, turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const weekStart = parseDate(searchParams.get("weekStart"));
  if (!studentId || !weekStart) return NextResponse.json({ error: "studentId e weekStart são obrigatórios" }, { status: 400 });

  try {
    const student = await getAuthorizedStudent(studentId, session);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const observation = await prisma.studentWeeklyObservation.findUnique({ where: { studentId_weekStart: { studentId, weekStart } } });
    return NextResponse.json({
      observation: observation ? { teacherObservation: observation.teacherObservation, behavior: observation.behavior ?? "", weekEnd: observation.weekEnd.toISOString().slice(0, 10) } : null,
    });
  } catch (error) {
    console.error("Student observation fetch error:", error);
    return NextResponse.json({ error: "Não foi possível carregar a observação." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") return NextResponse.json({ error: "Sem permissão para guardar observações." }, { status: 403 });

  try {
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const weekStart = parseDate(body.weekStart);
    const weekEnd = parseDate(body.weekEnd);
    const teacherObservation = typeof body.teacherObservation === "string" ? body.teacherObservation.trim().slice(0, 90) : "";
    const behavior = typeof body.behavior === "string" ? body.behavior.trim() : "";
    if (!studentId || !weekStart || !weekEnd) return NextResponse.json({ error: "Aluno e período semanal são obrigatórios" }, { status: 400 });
    if (!isCurrentWeeklyPeriod(weekStart)) return NextResponse.json({ error: "Só é possível alterar a observação da semana atual." }, { status: 400 });

    const student = await getAuthorizedStudent(studentId, session);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    if (!teacherObservation) {
      await prisma.studentWeeklyObservation.deleteMany({ where: { studentId, weekStart } });
      return NextResponse.json({ success: true, saved: false });
    }

    const observation = await prisma.studentWeeklyObservation.upsert({
      where: { studentId_weekStart: { studentId, weekStart } },
      update: { weekEnd, teacherObservation, behavior: behavior || null },
      create: { studentId, weekStart, weekEnd, teacherObservation, behavior: behavior || null },
    });
    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Registou observação semanal do aluno",
      entity: "StudentWeeklyObservation",
      entityId: observation.id,
      details: { studentId, weekStart: body.weekStart, weekEnd: body.weekEnd, behavior },
    });
    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    console.error("Student observation save error:", error);
    return NextResponse.json({ error: "Não foi possível guardar a observação." }, { status: 500 });
  }
}
