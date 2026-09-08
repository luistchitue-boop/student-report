import { PrismaClient } from "@prisma/client";

export async function isWeeklyPeriodClosed(weekStart: Date, weekEnd: Date, prisma: PrismaClient): Promise<boolean> {
  const closedPeriod = await prisma.closedWeeklyPeriod.findUnique({
    where: {
      weekStart_weekEnd: {
        weekStart,
        weekEnd,
      },
    },
  });
  return !!closedPeriod;
}

export async function getClosedWeeklyPeriods(prisma: PrismaClient) {
  return prisma.closedWeeklyPeriod.findMany({
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      closedAt: true,
      closedBy: { select: { id: true, name: true, email: true } },
      reason: true,
    },
    orderBy: { weekStart: "desc" },
  });
}
