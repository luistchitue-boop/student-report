import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { isWeeklyPeriodClosed, getClosedWeeklyPeriods } from "@/lib/closed-periods";
import { formatPeriodDate, getMonthlyCoordinationPeriods, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

declare global {
  var prismaAdminPeriods: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminPeriods ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAdminPeriods = prisma;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const [closedPeriods, monthlyClosures, turmas] = await Promise.all([
      getClosedWeeklyPeriods(prisma),
      prisma.closedTurmaMonthlyPeriod.findMany({
        include: {
          turma: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ periodStart: "desc" }, { turma: { name: "asc" } }],
      }),
      prisma.turma.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return NextResponse.json({ closedPeriods, monthlyClosures, turmas });
  } catch (error) {
    console.error("Error fetching closed periods:", error);
    return NextResponse.json({ error: "Não foi possível carregar os períodos fechados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, weekStart, weekEnd, reason } = body;

    if (action === "closeTurmaMonth" || action === "openTurmaMonth") {
      const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
      const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
      const years = [new Date().getFullYear() - 3, new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()];
      const period = years.flatMap((year) => getMonthlyCoordinationPeriods(year)).find((item) => item.key === periodKey);
      if (!turmaId || !period || period.start > new Date()) {
        return NextResponse.json({ error: "Selecione uma turma e um período mensal válido, não futuro." }, { status: 400 });
      }

      const start = new Date(`${formatPeriodDate(period.start)}T12:00:00.000Z`);
      const end = new Date(`${formatPeriodDate(period.end)}T12:00:00.000Z`);
      const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true } });
      if (!turma) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });

      if (action === "closeTurmaMonth") {
        const closure = await prisma.closedTurmaMonthlyPeriod.upsert({
          where: { turmaId_periodStart: { turmaId, periodStart: start } },
          update: { periodEnd: end, closedByUserId: session.user.id!, reason: typeof reason === "string" && reason.trim() ? reason.trim() : null },
          create: { turmaId, periodStart: start, periodEnd: end, closedByUserId: session.user.id!, reason: typeof reason === "string" && reason.trim() ? reason.trim() : null },
          include: { turma: { select: { id: true, name: true } }, closedBy: { select: { id: true, name: true, email: true } } },
        });
        return NextResponse.json({ success: true, monthlyClosure: closure });
      }

      const result = await prisma.closedTurmaMonthlyPeriod.deleteMany({ where: { turmaId, periodStart: start } });
      if (!result.count) return NextResponse.json({ error: "Este período mensal não está fechado para esta turma." }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: "Data de início e fim do período são obrigatórias." }, { status: 400 });
    }

    const requestedStart = new Date(weekStart);
    const requestedEnd = new Date(weekEnd);
    const period = getWeeklyCoordinationPeriods(requestedStart.getUTCFullYear()).find((item) => formatPeriodDate(item.start) === formatPeriodDate(requestedStart) && formatPeriodDate(item.end) === formatPeriodDate(requestedEnd));
    if (!period) return NextResponse.json({ error: "Período semanal inválido." }, { status: 400 });
    const start = new Date(`${formatPeriodDate(period.start)}T12:00:00.000Z`);
    const end = new Date(`${formatPeriodDate(period.end)}T12:00:00.000Z`);

    if (action === "close") {
      const alreadyClosed = await isWeeklyPeriodClosed(start, end, prisma);
      if (alreadyClosed) {
        return NextResponse.json({ error: "Este período já está fechado." }, { status: 400 });
      }

      const closedPeriod = await prisma.closedWeeklyPeriod.create({
        data: {
          weekStart: start,
          weekEnd: end,
          closedByUserId: session.user.id!,
          reason: reason || null,
        },
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          closedAt: true,
          closedBy: { select: { id: true, name: true, email: true } },
          reason: true,
        },
      });

      return NextResponse.json({ success: true, closedPeriod });
    } else if (action === "open") {
      const matchingPeriods = await prisma.closedWeeklyPeriod.findMany({
        where: { weekStart: { gte: new Date(`${formatPeriodDate(period.start)}T00:00:00.000Z`), lt: new Date(`${formatPeriodDate(period.start)}T23:59:59.999Z`) } },
        select: { id: true, weekEnd: true },
      });
      const ids = matchingPeriods.filter((closedPeriod) => formatPeriodDate(closedPeriod.weekEnd) === formatPeriodDate(period.end)).map((closedPeriod) => closedPeriod.id);
      const result = ids.length ? await prisma.closedWeeklyPeriod.deleteMany({ where: { id: { in: ids } } }) : { count: 0 };

      if (result.count === 0) {
        return NextResponse.json({ error: "Este período não está fechado." }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Período reabrerto com sucesso." });
    } else {
      return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
    }
  } catch (error) {
    console.error("Error managing closed periods:", error);
    return NextResponse.json({ error: "Não foi possível gerenciar os períodos fechados." }, { status: 500 });
  }
}
