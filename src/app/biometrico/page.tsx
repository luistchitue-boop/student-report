import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods, isDateInPeriod } from "@/lib/weekly-coordination";
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
    where: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const requestedTurmaId = searchParams ? (await searchParams).turmaId : undefined;
  const turmaId = turmas.some((turma) => turma.id === requestedTurmaId) ? requestedTurmaId! : turmas[0]?.id;
  const periods = getWeeklyCoordinationPeriods(now.getFullYear());
  const reports = await prisma.weeklyCoordinationReport.findMany({
    where: { userId: session.user.id, turmaId, weekStart: { in: periods.map((period) => period.start) } },
    select: { id: true, weekStart: true, weekEnd: true, title: true, description: true },
  });
  const reportByWeek = new Map(reports.map((report) => [formatPeriodDate(report.weekStart), report]));

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
            isCurrent: isDateInPeriod(now, period),
          }))}
        />
      </main>
    </AppShell>
  );
}