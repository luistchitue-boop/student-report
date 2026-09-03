import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { formatPeriodDate, getWeeklyCoordinationPeriods, isDateInPeriod } from "@/lib/weekly-coordination";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "COORDENADOR") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
    const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.descricao === "string" ? body.descricao.trim() : "";
    const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
    const period = periods.find((item) => item.key === weekStart);

    if (!period || !isDateInPeriod(new Date(), period)) {
      return NextResponse.json({ error: "Só pode preencher o período correspondente à data de hoje." }, { status: 400 });
    }

    const turma = await prisma.turma.findFirst({
      where: { id: turmaId, teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
      select: { id: true },
    });

    if (!turma) {
      return NextResponse.json({ error: "Não tem acesso a esta turma." }, { status: 403 });
    }

    if (!title || !description) {
      return NextResponse.json({ error: "O título e a descrição são obrigatórios." }, { status: 400 });
    }

    const report = await prisma.weeklyCoordinationReport.upsert({
      where: { userId_turmaId_weekStart: { userId: session.user.id, turmaId: turma.id, weekStart: period.start } },
      create: {
        userId: session.user.id,
        turmaId: turma.id,
        weekStart: period.start,
        weekEnd: period.end,
        title,
        description,
      },
      update: { title, description, weekEnd: period.end },
    });

    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Registou coordenação semanal",
      entity: "WeeklyCoordinationReport",
      entityId: report.id,
      details: { weekStart: formatPeriodDate(period.start), weekEnd: formatPeriodDate(period.end), title },
    });

    return NextResponse.json({ id: report.id, title: report.title, descricao: report.description });
  } catch (error) {
    console.error("Weekly coordination report error:", error);
    return NextResponse.json({ error: "Não foi possível guardar o relatório semanal." }, { status: 500 });
  }
}