import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { getClosedWeeklyPeriods } from "@/lib/closed-periods";
import { hasTurmaPeriodActivity } from "@/lib/turma-completeness";
import { BiometricoClient } from "./biometrico-client";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export default async function BiometricoPage({
  searchParams,
}: {
  searchParams?: Promise<{ turmaId?: string }>;
}) {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user?.id || !schoolContext || schoolContext.role !== "COORDENADOR") redirect("/");

  const now = new Date();
  const turmas = await prisma.turma.findMany({
    where: { schoolId: schoolContext.schoolId, teacherAssignments: { some: { isMain: true, teacher: { userId: session.user.id } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const requestedTurmaId = searchParams ? (await searchParams).turmaId : undefined;
  const turmaId = turmas.some((turma) => turma.id === requestedTurmaId) ? requestedTurmaId! : turmas[0]?.id;
  const periods = getWeeklyCoordinationPeriods(now.getFullYear());
  const closedPeriods = await getClosedWeeklyPeriods(prisma, schoolContext.schoolId);
  const closedPeriodKeys = new Set(closedPeriods.map((period) => `${formatPeriodDate(period.weekStart)}:${formatPeriodDate(period.weekEnd)}`));
  const reports = await prisma.weeklyCoordinationReport.findMany({
    where: { userId: session.user.id, turmaId, turma: { schoolId: schoolContext.schoolId }, weekStart: { gte: periods[0]?.start, lte: periods[periods.length - 1]?.end } },
    select: { id: true, weekStart: true, weekEnd: true, title: true, description: true },
  });
  const reportByWeek = new Map(reports.map((report) => [formatPeriodDate(report.weekStart), report]));
  const activityByPeriod = new Map(await Promise.all(periods.filter((period) => period.start <= now).map(async (period) => [period.key, await hasTurmaPeriodActivity(prisma, turmaId ?? "", period)] as const)));

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
            hasActivity: activityByPeriod.get(period.key) ?? false,
          }))}
        />
      </main>
    </AppShell>
  );
}