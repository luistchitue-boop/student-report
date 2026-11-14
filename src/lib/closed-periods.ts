import { PrismaClient } from "@prisma/client";
import { formatPeriodDate } from "@/lib/weekly-coordination";
import { getSchoolContext } from "@/lib/school-context";

export async function isWeeklyPeriodClosed(weekStart: Date, weekEnd: Date, prisma: PrismaClient, requestedSchoolId?: string): Promise<boolean> {
  const schoolId = requestedSchoolId ?? (await getSchoolContext())?.schoolId;
  if (!schoolId) return true;
  const closedPeriods = await prisma.closedWeeklyPeriod.findMany({
    where: { schoolId },
    select: { weekStart: true, weekEnd: true },
  });
  const startKey = formatPeriodDate(weekStart);
  const endKey = formatPeriodDate(weekEnd);
  const closedPeriod = closedPeriods.find((period) => formatPeriodDate(period.weekStart) === startKey && formatPeriodDate(period.weekEnd) === endKey);
  return !!closedPeriod;
}

export async function isTurmaWeeklyPeriodClosed(turmaId: string, weekStart: Date, weekEnd: Date, prisma: PrismaClient): Promise<boolean> {
  if (await isWeeklyPeriodClosed(weekStart, weekEnd, prisma)) return true;

  const monthlyClosure = await prisma.closedTurmaMonthlyPeriod.findFirst({
    where: {
      turmaId,
      periodStart: { lte: weekStart },
      periodEnd: { gte: weekEnd },
    },
    select: { id: true },
  });
  return !!monthlyClosure;
}

export async function isTurmaDateClosed(turmaId: string, date: Date, prisma: PrismaClient): Promise<boolean> {
  const schoolId = (await getSchoolContext())?.schoolId;
  if (!schoolId) return true;
  const dateStart = new Date(`${formatPeriodDate(date)}T00:00:00.000Z`);
  const dateEnd = new Date(`${formatPeriodDate(date)}T23:59:59.999Z`);
  const [weeklyClosure, monthlyClosure] = await Promise.all([
    prisma.closedWeeklyPeriod.findFirst({
      where: { schoolId, weekStart: { lte: dateEnd }, weekEnd: { gte: dateStart } },
      select: { id: true },
    }),
    prisma.closedTurmaMonthlyPeriod.findFirst({
      where: { turmaId, periodStart: { lte: dateEnd }, periodEnd: { gte: dateStart } },
      select: { id: true },
    }),
  ]);
  return Boolean(weeklyClosure || monthlyClosure);
}

export async function getClosedWeeklyPeriods(prisma: PrismaClient, requestedSchoolId?: string) {
  const schoolId = requestedSchoolId ?? (await getSchoolContext())?.schoolId;
  if (!schoolId) return [];
  return prisma.closedWeeklyPeriod.findMany({
    where: { schoolId },
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
