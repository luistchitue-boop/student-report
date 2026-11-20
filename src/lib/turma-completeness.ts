import { PrismaClient } from "@prisma/client";
import { formatPeriodDate, type WeeklyPeriod } from "@/lib/weekly-coordination";

export async function hasTurmaPeriodActivity(prisma: PrismaClient, turmaId: string, period: WeeklyPeriod) {
  const term = `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}`;
  const startOfPeriod = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate());
  const dayAfterStart = new Date(startOfPeriod);
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);
  const dayAfterPeriod = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() + 1);
  const studentWithActivity = await prisma.student.findFirst({
    where: {
      turmaId,
      OR: [
        { absences: { some: { dia: { gte: startOfPeriod, lt: dayAfterPeriod } } } },
        {
          grades: {
            some: {
              OR: [
                { term },
                { createdAt: { gte: startOfPeriod, lt: dayAfterPeriod } },
              ],
            },
          },
        },
        { weeklyObservations: { some: { weekStart: { gte: startOfPeriod, lt: dayAfterStart } } } },
      ],
    },
    select: { id: true },
  });

  return Boolean(studentWithActivity);
}
