import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

const prisma = new PrismaClient();

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function getCoordinator(session: { user: { id: string; role?: string | null } }) {
  if ((session.user.role ?? "COORDENADOR") !== "COORDENADOR") return null;
  return prisma.teacher.findUnique({ where: { userId: session.user.id }, select: { id: true, name: true } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const teacher = await getCoordinator(session);
  if (!teacher) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  const students = await prisma.student.findMany({
    where: { turma: { isInternship: true }, internshipAssignments: { some: { teacherId: teacher.id } } },
    orderBy: [{ turma: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      avatarUrl: true,
      turma: { select: { id: true, name: true } },
      internshipPerformanceReports: { where: { teacherId: teacher.id }, orderBy: { periodStart: "desc" } },
    },
  });
  return NextResponse.json({ students });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const teacher = await getCoordinator(session);
  if (!teacher) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  try {
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const periodStart = parseDate(body.periodStart);
    const periodEnd = parseDate(body.periodEnd);
    const performanceRating = Number(body.performanceRating);
    const companyName = text(body.companyName, 160);
    const position = text(body.position, 160);
    const strengths = text(body.strengths, 3000);
    const improvementAreas = text(body.improvementAreas, 3000);
    const comments = text(body.comments, 4000);

    if (!studentId || !periodStart || !periodEnd || periodStart > periodEnd) return NextResponse.json({ error: "Indique um aluno e um intervalo de datas válido." }, { status: 400 });
    if (!Number.isInteger(performanceRating) || performanceRating < 1 || performanceRating > 5) return NextResponse.json({ error: "A avaliação deve estar entre 1 e 5." }, { status: 400 });
    if (!strengths || !improvementAreas || !comments) return NextResponse.json({ error: "Preencha os pontos fortes, aspetos a melhorar e observações." }, { status: 400 });

    const student = await prisma.student.findFirst({
      where: { id: studentId, turma: { isInternship: true }, internshipAssignments: { some: { teacherId: teacher.id } } },
      select: { id: true, name: true, turmaId: true },
    });
    if (!student) return NextResponse.json({ error: "Não tem acesso a este aluno." }, { status: 404 });

    const report = await prisma.internshipPerformanceReport.upsert({
      where: { studentId_teacherId_periodStart: { studentId, teacherId: teacher.id, periodStart } },
      update: { periodEnd, companyName: companyName || null, position: position || null, performanceRating, strengths, improvementAreas, comments },
      create: { studentId, teacherId: teacher.id, periodStart, periodEnd, companyName: companyName || null, position: position || null, performanceRating, strengths, improvementAreas, comments },
    });
    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Registou avaliação de estágio do aluno",
      entity: "InternshipPerformanceReport",
      entityId: report.id,
      details: { studentId, studentName: student.name, turmaId: student.turmaId, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), performanceRating },
    });
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Internship report save error:", error);
    return NextResponse.json({ error: "Não foi possível guardar o relatório de estágio." }, { status: 500 });
  }
}
