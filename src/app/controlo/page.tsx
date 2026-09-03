import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { ControloExportButton } from "./controlo-export-button";

const prisma = new PrismaClient();
const PAGE_SIZE = 6;

export default async function ControloPage({
  searchParams,
}: {
  searchParams?: Promise<{ turmaId?: string; page?: string; month?: string }>;
}) {
  const session = await auth();
  const role = session?.user?.role ?? "COORDENADOR";

  if (!session?.user?.id || (role !== "ADMIN" && role !== "DIRECCAO")) redirect("/");

  const turmas = await prisma.turma.findMany({
    where: role === "ADMIN" ? undefined : { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teacherAssignments: { select: { isMain: true, teacher: { select: { id: true, name: true, userId: true, role: true } } } } },
  });
  const params = searchParams ? await searchParams : {};
  const requestedTurmaId = params.turmaId;
  const requestedPage = Number(params.page ?? "1");
  const requestedMonth = params.month ?? "";
  const selectedTurma = turmas.find((turma) => turma.id === requestedTurmaId) ?? turmas[0];
  const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const filteredPeriods = requestedMonth
    ? periods.filter((period) => String(period.start.getMonth() + 1) === requestedMonth)
    : periods;
  const monthOptions = [...new Set(periods.map((period) => period.start.getMonth() + 1))];
  const totalPages = Math.max(1, Math.ceil(filteredPeriods.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visiblePeriods = filteredPeriods.slice(startIndex, startIndex + PAGE_SIZE);
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
            <label htmlFor="controlo-month">Mês</label>
            <select id="controlo-month" name="month" defaultValue={requestedMonth}>
              <option value="">Todos os meses</option>
              {monthOptions.map((month) => <option key={month} value={month}>{new Date(new Date().getFullYear(), month - 1, 1).toLocaleDateString("pt-AO", { month: "long" })}</option>)}
            </select>
            <button type="submit" className="admin-submit" disabled={!turmas.length}>Verificar</button>
          </form>

          {selectedTurma ? (
            <>
              <div className="controlo-summary">
                <span>Coordenador(a)</span>
                <strong>{coordinatorNames || "Sem coordenador atribuído"}</strong>
              </div>
              <div className="controlo-actions">
                <ControloExportButton
                  turmaName={selectedTurma.name}
                  coordinatorName={coordinatorNames || "Sem coordenador atribuído"}
                  year={new Date().getFullYear()}
                  periods={filteredPeriods.map((period) => ({
                    start: period.start.toISOString(),
                    end: period.end.toISOString(),
                    isTest: period.isTest,
                    title: reportsByWeek.get(period.key)?.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") ?? "",
                    registered: reportsByWeek.has(period.key),
                  }))}
                />
              </div>
              <div className="controlo-list">
                {visiblePeriods.map((period) => {
                  const periodReports = reportsByWeek.get(period.key) ?? [];
                  return (
                    <div key={period.key} className="controlo-period">
                      <div><span className="controlo-period-date">{period.start.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} - {period.end.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}</span><strong>{periodReports.length ? periodReports.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") : "Sem registo semanal"}</strong></div>
                      <span className={`biometrico-status ${periodReports.length ? "registado" : mainCoordinator ? "ausente" : "sem-coordenador"}`}>{periodReports.length ? "Registado" : mainCoordinator ? "Ausente" : "Sem coordenador principal"}</span>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <nav className="pagination" aria-label="Paginação dos períodos de coordenação">
                  <a href={`/controlo?turmaId=${selectedTurma.id}${requestedMonth ? `&month=${requestedMonth}` : ""}&page=${Math.max(1, currentPage - 1)}`} className={currentPage === 1 ? "page-button disabled" : "page-button"} aria-disabled={currentPage === 1}>Anterior</a>
                  <div className="pagination-compact" aria-label="Páginas dos períodos">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <a key={page} href={`/controlo?turmaId=${selectedTurma.id}${requestedMonth ? `&month=${requestedMonth}` : ""}&page=${page}`} className={page === currentPage ? "page-button active" : "page-button"} aria-current={page === currentPage ? "page" : undefined}>{page}</a>
                    ))}
                  </div>
                  <a href={`/controlo?turmaId=${selectedTurma.id}${requestedMonth ? `&month=${requestedMonth}` : ""}&page=${Math.min(totalPages, currentPage + 1)}`} className={currentPage === totalPages ? "page-button disabled" : "page-button"} aria-disabled={currentPage === totalPages}>Seguinte</a>
                </nav>
              )}
            </>
          ) : (
            <p className="admin-status idle">Não existem turmas disponíveis para controlo.</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}