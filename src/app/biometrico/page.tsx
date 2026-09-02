import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods, isDateInPeriod } from "@/lib/weekly-coordination";
import { BiometricoClient } from "./biometrico-client";

const prisma = new PrismaClient();

export default async function BiometricoPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "COORDENADOR") redirect("/");

  const now = new Date();
  const periods = getWeeklyCoordinationPeriods(now.getFullYear());
  const reports = await prisma.weeklyCoordinationReport.findMany({
    where: { userId: session.user.id, weekStart: { in: periods.map((period) => period.start) } },
    select: { id: true, weekStart: true, weekEnd: true, title: true, description: true },
  });
  const reportByWeek = new Map(reports.map((report) => [formatPeriodDate(report.weekStart), report]));

  return (
    <AppShell active="biometrico">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">COORDENAÇÃO SEMANAL / {now.getFullYear()}</p>
            <h1>Biometrico</h1>
          </div>
        </header>
        <BiometricoClient
          periods={periods.map((period) => ({
            key: period.key,
            start: period.start.toISOString(),
            end: period.end.toISOString(),
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