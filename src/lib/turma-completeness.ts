import { PrismaClient } from "@prisma/client";
import { formatPeriodDate, type WeeklyPeriod } from "@/lib/weekly-coordination";

export async function hasTurmaPeriodActivity(prisma: PrismaClient, turmaId: string, period: WeeklyPeriod) {
  const term = `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}`;
  const studentWithActivity = await prisma.student.findFirst({
    where: {
      turmaId,
      OR: [
        { absences: { some: { dia: { gte: period.start, lte: period.end } } } },
        { grades: { some: { term } } },
        { weeklyObservations: { some: { weekStart: period.start } } },
      ],
    },
    select: { id: true },
  });

  return Boolean(studentWithActivity);
}
