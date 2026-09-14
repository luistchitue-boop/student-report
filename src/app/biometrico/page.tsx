import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { getClosedWeeklyPeriods } from "@/lib/closed-periods";
import { getTurmaPeriodCompleteness } from "@/lib/turma-completeness";
import { BiometricoClient } from "./biometrico-client";

const prisma = new PrismaClient();

export default async function BiometricoPage({
  searchParams,
}: {
  searchParams?: Promise<{ turmaId?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "COORDENADOR") redirect("/");

  const now = new Date();
  const turmas = await prisma.turma.findMany({
    where: { teacherAssignments: { some: { isMain: true, teacher: { userId: session.user.id, role: "COORDENADOR" } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const requestedTurmaId = searchParams ? (await searchParams).turmaId : undefined;
  const turmaId = turmas.some((turma) => turma.id === requestedTurmaId) ? requestedTurmaId! : turmas[0]?.id;
  const periods = getWeeklyCoordinationPeriods(now.getFullYear());
  const closedPeriods = await getClosedWeeklyPeriods(prisma);
  const closedPeriodKeys = new Set(closedPeriods.map((period) => `${formatPeriodDate(period.weekStart)}:${formatPeriodDate(period.weekEnd)}`));
  const reports = await prisma.weeklyCoordinationReport.findMany({
    where: { userId: session.user.id, turmaId, weekStart: { gte: periods[0]?.start, lte: periods[periods.length - 1]?.end } },
    select: { id: true, weekStart: true, weekEnd: true, title: true, description: true },
  });
  const reportByWeek = new Map(reports.map((report) => [formatPeriodDate(report.weekStart), report]));
  const completenessByPeriod = new Map((await Promise.all(periods.filter((period) => period.start <= now).map(async (period) => [period.key, await getTurmaPeriodCompleteness(prisma, turmaId ?? "", period)] as const))).filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1])));

  return (
    <AppShell active="biometrico">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">COORDENAÇÃO SEMANAL / {now.getFullYear()}</p>
            <h1>Biométrico</h1>
          </div>
        </header>
        <BiometricoClient
          turmas={turmas}
          selectedTurmaId={turmaId ?? ""}
          periods={periods.map((period) => ({
            key: period.key,
            start: period.start.toISOString(),
            end: period.end.toISOString(),
            isTest: period.isTest,
            status: reportByWeek.has(period.key) ? "registado" : "ausente",
            title: reportByWeek.get(period.key)?.title ?? "",
            description: reportByWeek.get(period.key)?.description ?? "",
            isCurrent: period.start <= now && period.end >= now,
            isClosed: closedPeriodKeys.has(`${period.key}:${formatPeriodDate(period.end)}`),
            isComplete: completenessByPeriod.get(period.key)?.complete ?? false,
            missingSubjects: completenessByPeriod.get(period.key)?.missingSubjects ?? [],
            missingBehaviorCount: completenessByPeriod.get(period.key)?.missingBehaviorStudents.length ?? 0,
          }))}
        />
      </main>
    </AppShell>
  );
}