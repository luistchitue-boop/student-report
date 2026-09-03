import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { ControloExportButton } from "./controlo-export-button";

const prisma = new PrismaClient();

export default async function ControloPage({
  searchParams,
}: {
  searchParams?: Promise<{ turmaId?: string }>;
}) {
  const session = await auth();
  const role = session?.user?.role ?? "COORDENADOR";

  if (!session?.user?.id || (role !== "ADMIN" && role !== "DIRECCAO")) redirect("/");

  const turmas = await prisma.turma.findMany({
    where: role === "ADMIN" ? undefined : { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teacherAssignments: { select: { isMain: true, teacher: { select: { id: true, name: true, userId: true, role: true } } } } },
  });
  const requestedTurmaId = searchParams ? (await searchParams).turmaId : undefined;
  const selectedTurma = turmas.find((turma) => turma.id === requestedTurmaId) ?? turmas[0];
  const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const mainCoordinator = selectedTurma?.teacherAssignments.find((assignment) => assignment.isMain && assignment.teacher.role === "COORDENADOR")?.teacher;
  const reportRangeStart = periods[0]?.start;
  const reportRangeEnd = periods[periods.length - 1]?.end;
  const reports = mainCoordinator
    ? await prisma.weeklyCoordinationReport.findMany({
        where: { turmaId: selectedTurma.id, userId: mainCoordinator.userId, weekStart: { gte: reportRangeStart, lte: reportRangeEnd } },
        select: { weekStart: true, title: true, userId: true, user: { select: { name: true, email: true } } },
      })
    : [];
  const reportsByWeek = new Map<string, typeof reports>();
  for (const report of reports) {
    const current = reportsByWeek.get(formatPeriodDate(report.weekStart)) ?? [];
    reportsByWeek.set(formatPeriodDate(report.weekStart), [...current, report]);
  }
  const coordinatorNames = mainCoordinator?.name ?? "";

  return (
    <AppShell active="controlo">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ACOMPANHAMENTO / {new Date().getFullYear()}</p>
            <h1>Controlo</h1>
          </div>
        </header>

        <section className="controlo-shell workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BIOMÉTRICO</p>
              <h3>Verificação da coordenação semanal</h3>
            </div>
          </div>

          <form method="get" className="controlo-turma-switcher">
            <label htmlFor="controlo-turma">Turma</label>
            <select id="controlo-turma" name="turmaId" defaultValue={selectedTurma?.id ?? ""}>
              {!turmas.length && <option value="">Nenhuma turma disponível</option>}
              {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
            </select>
            <button type="submit" className="admin-submit" disabled={!turmas.length}>Verificar</button>
          </form>

          {selectedTurma ? (
            <>
              <div className="controlo-summary">
                <span>Coordenador</span>
                <strong>{coordinatorNames || "Sem coordenador atribuído"}</strong>
              </div>
              <div className="controlo-actions">
                <ControloExportButton
                  turmaName={selectedTurma.name}
                  coordinatorName={coordinatorNames || "Sem coordenador atribuído"}
                  year={new Date().getFullYear()}
                  periods={periods.map((period) => ({
                    start: period.start.toISOString(),
                    end: period.end.toISOString(),
                    isTest: period.isTest,
                    title: reportsByWeek.get(period.key)?.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") ?? "",
                    registered: reportsByWeek.has(period.key),
                  }))}
                />
              </div>
              <div className="controlo-list">
                {periods.map((period) => {
                  const periodReports = reportsByWeek.get(period.key) ?? [];
                  return (
                    <div key={period.key} className="controlo-period">
                      <div><span className="controlo-period-date">{period.start.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} - {period.end.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}</span><strong>{periodReports.length ? periodReports.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") : "Sem registo semanal"}</strong></div>
                      <span className={`biometrico-status ${periodReports.length ? "registado" : mainCoordinator ? "ausente" : "sem-coordenador"}`}>{periodReports.length ? "Registado" : mainCoordinator ? "Ausente" : "Sem coordenador principal"}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="admin-status idle">Não existem turmas disponíveis para controlo.</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}