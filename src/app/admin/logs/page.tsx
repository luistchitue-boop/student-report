import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrismaClient } from "@prisma/client";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();
const PAGE_SIZE = 12;
const ACTION_PREVIEW_LIMIT = 64;

function formatActionPreview(action: string) {
  return action.length > ACTION_PREVIEW_LIMIT
    ? `${action.slice(0, ACTION_PREVIEW_LIMIT).trimEnd()}…`
    : action;
}

function formatDisplayName(name: string) {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return trimmed;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function formatInvolvedSubject(
  entity: string,
  details: Record<string, unknown> | null,
  turmaNames: Record<string, string>,
  studentNames: Record<string, string>
) {
  const parts = [entity];
  const subject = typeof details?.subject === "string" ? details.subject : "";
  const turmaId = typeof details?.turmaId === "string" ? details.turmaId : "";
  const studentIds = Array.isArray(details?.studentIds)
    ? details.studentIds.filter((id): id is string => typeof id === "string")
    : typeof details?.studentId === "string"
      ? [details.studentId]
      : [];

  if (subject) parts.push(subject);
  if (turmaId) parts.push(turmaNames[turmaId] ?? "Turma");
  if (studentIds.length === 1) {
    parts.push(formatDisplayName(studentNames[studentIds[0]] ?? "Aluno"));
  } else if (studentIds.length > 1) {
    parts.push(`${studentIds.length} alunos`);
  }

  return parts.join(" • ");
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  const params = searchParams ? await searchParams : {};
  const turmaFilter = typeof params.turmaId === "string" ? params.turmaId : "";
  const fromFilter = typeof params.from === "string" ? params.from : "";
  const toFilter = typeof params.to === "string" ? params.to : "";
  const requestedPage = Number(typeof params.page === "string" ? params.page : "1");

  const where = {
    schoolId: schoolContext.schoolId,
    ...(turmaFilter ? { details: { path: ["turmaId"], equals: turmaFilter } } : {}),
    ...(fromFilter || toFilter ? {
      createdAt: {
        ...(fromFilter ? { gte: new Date(`${fromFilter}T00:00:00Z`) } : {}),
        ...(toFilter ? { lte: new Date(`${toFilter}T23:59:59.999Z`) } : {}),
      },
    } : {}),
  };
  const totalCount = await prisma.activityLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleLogs = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: startIndex,
    take: PAGE_SIZE,
    include: {
      actor: { select: { name: true, email: true, teacher: { select: { name: true } } } },
    },
  });

  const buildPageHref = (page: number) => {
    const query = new URLSearchParams();
    if (turmaFilter) query.set("turmaId", turmaFilter);
    if (fromFilter) query.set("from", fromFilter);
    if (toFilter) query.set("to", toFilter);
    if (page > 1) query.set("page", String(page));
    const queryString = query.toString();
    return queryString ? `/admin/logs?${queryString}` : "/admin/logs";
  };

  const pageItems = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [1, ...(currentPage > 3 ? ["ellipsis-start"] : []), ...Array.from({ length: 3 }, (_, index) => Math.max(2, Math.min(currentPage - 1, totalPages - 3) + index)), ...(currentPage < totalPages - 2 ? ["ellipsis-end"] : []), totalPages];

  const turmas = await prisma.turma.findMany({
    where: { schoolId: schoolContext.schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const studentIds = new Set<string>();
  const turmaIds = new Set<string>();
  for (const entry of visibleLogs) {
    const details = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;
    if (!details) continue;

    const pushIds = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") studentIds.add(item);
        }
        return;
      }
      if (typeof value === "string") studentIds.add(value);
    };

    pushIds(details.studentId);
    pushIds(details.studentIds);

    if (typeof details.turmaId === "string") turmaIds.add(details.turmaId);
  }

  const studentNames = Object.fromEntries(
    (await prisma.student.findMany({
      where: { id: { in: [...studentIds] }, turma: { schoolId: schoolContext.schoolId } },
      select: { id: true, name: true },
    })).map((student) => [student.id, student.name])
  );

  const turmaNames = Object.fromEntries(
    (await prisma.turma.findMany({
      where: { id: { in: [...turmaIds] }, schoolId: schoolContext.schoolId },
      select: { id: true, name: true },
    })).map((turma) => [turma.id, turma.name])
  );

  return (
    <AppShell active="logs">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ADMINISTRAÇÃO</p>
            <h1>Registo de atividades</h1>
          </div>
        </header>

        <Card className="admin-shell w-full max-w-none gap-0 overflow-visible py-0">
          <CardHeader className="border-b px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground">AUDITORIA</p>
            <CardTitle className="text-lg">Quem registou o quê e quando</CardTitle>
            <CardDescription>Consulte as atividades registadas na escola e filtre por turma ou data.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 sm:p-6">
            <form method="get" className="grid items-end gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto]">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="logs-turma">Turma</Label>
                <Select name="turmaId" defaultValue={turmaFilter || null}>
                  <SelectTrigger id="logs-turma" className="h-10 w-full">
                    <SelectValue placeholder="Todas as turmas" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid min-w-0 gap-2">
                <Label htmlFor="logs-period">Período</Label>
                <DateRangePicker
                  id="logs-period"
                  fromName="from"
                  toName="to"
                  defaultFrom={fromFilter}
                  defaultTo={toFilter}
                  placeholder="Selecionar intervalo de datas"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="h-10">Filtrar</Button>
                {(turmaFilter || fromFilter || toFilter) && (
                  <Button variant="outline" className="h-10" render={<Link href="/admin/logs" />}>Limpar</Button>
                )}
              </div>
            </form>

            <div className="overflow-hidden rounded-xl border">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[320px] text-xs uppercase tracking-wide text-muted-foreground">Operação</TableHead>
                    <TableHead className="w-[220px] text-xs uppercase tracking-wide text-muted-foreground">Utilizador</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Envolvido</TableHead>
                    <TableHead className="w-[190px] text-right text-xs uppercase tracking-wide text-muted-foreground">Data e hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totalCount === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-28 text-center whitespace-normal text-muted-foreground">
                        Ainda não existem registos de atividade para este filtro.
                      </TableCell>
                    </TableRow>
                  ) : visibleLogs.map((entry) => {
                    const details = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="w-[320px] max-w-[320px]">
                          <Badge variant="secondary" className="max-w-full truncate" title={entry.action}>
                            {formatActionPreview(entry.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="font-medium text-foreground">{entry.actor.teacher?.name || entry.actor.name || entry.actor.email || entry.actorName}</span>
                        </TableCell>
                        <TableCell className="max-w-[420px] whitespace-normal break-words text-muted-foreground">
                          {formatInvolvedSubject(entry.entity, details, turmaNames, studentNames)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <time dateTime={entry.createdAt.toISOString()}>{new Date(entry.createdAt).toLocaleString("pt-AO")}</time>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginação dos registos de atividade">
                <Button
                  variant="outline"
                  render={<Link href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)} aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined} />}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <ArrowLeft /> Anterior
                </Button>
                <div className="flex items-center gap-1" aria-label="Páginas dos registos">
                  {pageItems.map((page, index) => typeof page === "number" ? (
                    <Button
                      key={`${page}-${index}`}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="icon"
                      render={<Link href={buildPageHref(page)} aria-current={page === currentPage ? "page" : undefined} aria-label={`Página ${page}`} />}
                    >
                      {page}
                    </Button>
                  ) : <span key={page} className="px-2 text-sm text-muted-foreground" aria-hidden="true">…</span>)}
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
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
