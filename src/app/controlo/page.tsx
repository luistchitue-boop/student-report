import { redirect } from "next/navigation";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { getCurrentPage, getPaginationItems } from "@/lib/pagination";
import { ControloExportButton } from "./controlo-export-button";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();
const PAGE_SIZE = 6;

export default async function ControloPage({
  searchParams,
}: {
  searchParams?: Promise<{ turmaId?: string; page?: string; month?: string }>;
}) {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  const role = schoolContext?.role ?? "COORDENADOR";

  if (!session?.user?.id || !schoolContext || (role !== "ADMIN" && role !== "DIRECCAO")) redirect("/");

  const turmas = await prisma.turma.findMany({
    where: role === "ADMIN"
      ? { schoolId: schoolContext.schoolId }
      : { schoolId: schoolContext.schoolId, teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, teacherAssignments: { select: { isMain: true, teacher: { select: { id: true, name: true, userId: true, user: { select: { schoolMemberships: { where: { schoolId: schoolContext.schoolId }, select: { role: true } } } } } } } } },
  });
  const params = searchParams ? await searchParams : {};
  const requestedTurmaId = params.turmaId;
  const requestedMonth = params.month ?? "";
  const selectedTurma = turmas.find((turma) => turma.id === requestedTurmaId) ?? turmas[0];
  const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const filteredPeriods = requestedMonth
    ? periods.filter((period) => String(period.start.getMonth() + 1) === requestedMonth)
    : periods;
  const monthOptions = [...new Set(periods.map((period) => period.start.getMonth() + 1))];
  const totalPages = Math.max(1, Math.ceil(filteredPeriods.length / PAGE_SIZE));
  const currentPage = getCurrentPage(params.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visiblePeriods = filteredPeriods.slice(startIndex, startIndex + PAGE_SIZE);
  const buildPageHref = (page: number) => {
    const search = new URLSearchParams();
    if (selectedTurma) search.set("turmaId", selectedTurma.id);
    if (requestedMonth) search.set("month", requestedMonth);
    if (page > 1) search.set("page", String(page));
    const queryString = search.toString();
    return queryString ? `/controlo?${queryString}` : "/controlo";
  };
  const pageItems = getPaginationItems(currentPage, totalPages);
  const mainCoordinator = selectedTurma?.teacherAssignments.find((assignment) => assignment.isMain && assignment.teacher.user.schoolMemberships[0]?.role === "COORDENADOR")?.teacher;
  const reportRangeStart = periods[0]?.start;
  const reportRangeEnd = periods[periods.length - 1]?.end;
  const reports = mainCoordinator
    ? await prisma.weeklyCoordinationReport.findMany({
        where: { turmaId: selectedTurma.id, userId: mainCoordinator.userId, weekStart: { gte: reportRangeStart, lte: reportRangeEnd } },
        select: { weekStart: true, title: true, description: true, userId: true, user: { select: { name: true, email: true } } },
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

        <Card className="controlo-shell w-full max-w-none gap-0 overflow-visible py-0">
          <CardHeader className="border-b px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">BIOMÉTRICO</p>
            <CardTitle className="text-lg">Verificação da coordenação semanal</CardTitle>
            <CardDescription>Consulte os registos semanais por turma e período.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:p-6">
            <form method="get" className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="controlo-turma">Turma</Label>
                <Select name="turmaId" defaultValue={selectedTurma?.id ?? null} disabled={!turmas.length}>
                  <SelectTrigger id="controlo-turma" className="h-10 w-full">
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="controlo-month">Mês</Label>
                <Select name="month" defaultValue={requestedMonth || null}>
                  <SelectTrigger id="controlo-month" className="h-10 w-full">
                    <SelectValue placeholder="Todos os meses" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {monthOptions.map((month) => <SelectItem key={month} value={String(month)}>{new Date(new Date().getFullYear(), month - 1, 1).toLocaleDateString("pt-AO", { month: "long" })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="h-10" disabled={!turmas.length}>Verificar</Button>
            </form>

            {selectedTurma ? (
              <>
                <div className="flex flex-col gap-1 rounded-lg border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-xs font-medium text-muted-foreground">Coordenador(a)</span>
                  <strong className="text-sm font-semibold text-foreground">{coordinatorNames || "Sem coordenador atribuído"}</strong>
                </div>
                <div className="flex justify-end">
                  <ControloExportButton
                    turmaName={selectedTurma.name}
                    coordinatorName={coordinatorNames || "Sem coordenador atribuído"}
                    year={new Date().getFullYear()}
                    periods={filteredPeriods.map((period) => ({
                      start: period.start.toISOString(),
                      end: period.end.toISOString(),
                      isTest: period.isTest,
                      title: reportsByWeek.get(period.key)?.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") ?? "",
                      description: reportsByWeek.get(period.key)?.map((report) => report.description).join("\n\n") ?? "",
                      registered: reportsByWeek.has(period.key),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  {visiblePeriods.map((period) => {
                    const periodReports = reportsByWeek.get(period.key) ?? [];
                    return (
                      <div key={period.key} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="grid min-w-0 gap-1">
                          <span className="text-xs text-muted-foreground">{period.start.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })} - {period.end.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}</span>
                          <strong className="break-words text-sm font-medium text-foreground">{periodReports.length ? periodReports.map((report) => `${report.user.name ?? report.user.email}: ${report.title}`).join(", ") : "Sem registo semanal"}</strong>
                        </div>
                        <Badge variant={periodReports.length ? "secondary" : "outline"} className="h-auto w-fit max-w-full whitespace-normal text-left">
                          {periodReports.length ? "Registado" : mainCoordinator ? "Ausente" : "Sem coordenador principal"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginação dos períodos de coordenação">
                    <Button
                      variant="outline"
                      render={<Link href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)} aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined} />}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    >
                      <ArrowLeft /> Anterior
                    </Button>
                    <div className="flex items-center gap-1" aria-label="Páginas dos períodos">
                      {pageItems.map((page, index) => typeof page === "number" ? (
                        <Button
                          key={`${page}-${index}`}
                          variant={page === currentPage ? "default" : "ghost"}
                          size="icon"
                          render={<Link href={buildPageHref(page)} aria-current={page === currentPage ? "page" : undefined} aria-label={`Página ${page}`} />}
                        >
                          {page}
                        </Button>
                      ) : <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground" aria-hidden="true">…</span>)}
                    </div>
                    <Button
                      variant="outline"
                      render={<Link href={currentPage === totalPages ? buildPageHref(totalPages) : buildPageHref(currentPage + 1)} aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined} />}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    >
                      Próxima <ArrowRight />
                    </Button>
                  </nav>
                )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Não existem turmas disponíveis para controlo.</p>
          )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}