import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { isWeeklyPeriodClosed, getClosedWeeklyPeriods } from "@/lib/closed-periods";

declare global {
  var prismaAdminPeriods: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminPeriods ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAdminPeriods = prisma;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const closedPeriods = await getClosedWeeklyPeriods(prisma);
    return NextResponse.json({ closedPeriods });
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

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: "Data de início e fim do período são obrigatórias." }, { status: 400 });
    }

    const start = new Date(weekStart);
    const end = new Date(weekEnd);

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
      const result = await prisma.closedWeeklyPeriod.deleteMany({
        where: {
          weekStart: start,
          weekEnd: end,
        },
      });

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
