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
    select: { id: true, name: true, coordinator: { select: { id: true, name: true, userId: true } } },
  });
  const requestedTurmaId = searchParams ? (await searchParams).turmaId : undefined;
  const selectedTurma = turmas.find((turma) => turma.id === requestedTurmaId) ?? turmas[0];
  const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const reports = selectedTurma?.coordinator
    ? await prisma.weeklyCoordinationReport.findMany({
        where: { turmaId: selectedTurma.id, userId: selectedTurma.coordinator.userId, weekStart: { in: periods.map((period) => period.start) } },
        select: { weekStart: true, title: true },
      })
    : [];
  const reportsByWeek = new Map(reports.map((report) => [formatPeriodDate(report.weekStart), report]));

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
                <strong>{selectedTurma.coordinator?.name ?? "Sem coordenador atribuído"}</strong>
              </div>
              <div className="controlo-actions">
                <ControloExportButton
                  turmaName={selectedTurma.name}
                  coordinatorName={selectedTurma.coordinator?.name ?? "Sem coordenador atribuído"}
                  year={new Date().getFullYear()}
                  periods={periods.map((period) => ({
                    start: period.start.toISOString(),
                    end: period.end.toISOString(),
                    isTest: period.isTest,
                    title: reportsByWeek.get(period.key)?.title ?? "",
                    registered: reportsByWeek.has(period.key),
                  }))}
                />
              </div>
              <div className="controlo-list">
                {periods.map((period) => {
                  const report = reportsByWeek.get(period.key);
                  return (
                    <div key={period.key} className="controlo-period">
                      <div><span className="controlo-period-date">{period.start.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} - {period.end.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}</span><strong>{report?.title ?? "Sem registo semanal"}</strong></div>
                      <span className={`biometrico-status ${report ? "registado" : selectedTurma.coordinator ? "ausente" : "sem-coordenador"}`}>{report ? "Registado" : selectedTurma.coordinator ? "Ausente" : "Sem coordenador"}</span>
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