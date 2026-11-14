import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import TurmaDeleteAction from "./turma-delete-action";
import TurmasActions from "./turmas-actions";
import { TopTurmasMonthlyRanking } from "./top-turmas-monthly-ranking";
import { getSchoolContext } from "@/lib/school-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Image as ImageIcon,
  Search,
  Users,
} from "lucide-react";

const PAGE_SIZE = 6;

export default async function TurmasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] | undefined; q?: string | string[] | undefined; student?: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) redirect("/");
  const role = schoolContext.role;

  const allTurmas = await getCoordinatorTurmas(session.user.id);
  const params = await searchParams;
  const rawPage = params?.page;
  const rawQuery = params?.q;
  const rawStudentQuery = params?.student;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim();
  const studentQuery = (Array.isArray(rawStudentQuery) ? rawStudentQuery[0] : rawStudentQuery ?? "").trim();
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const normalizedStudentQuery = normalizeSearch(studentQuery);
  const matchingStudents = studentQuery.length >= 2
    ? allTurmas.flatMap((turma) => turma.roster
      .filter((student) => normalizeSearch(student.name).includes(normalizedStudentQuery))
      .map((student) => ({ ...student, turmaId: turma.id, turmaName: turma.name })))
    : [];
  const turmas = query
    ? allTurmas.filter((turma) => turma.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    : allTurmas;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1");
  const totalPages = Math.max(1, Math.ceil(turmas.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleTurmas = turmas.slice(startIndex, startIndex + PAGE_SIZE);
  const totalStudents = turmas.reduce((sum, turma) => sum + turma.students, 0);
  const averageStudents = turmas.length ? Math.round(totalStudents / turmas.length) : 0;

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (page > 1) search.set("page", String(page));
    const queryString = search.toString();
    return queryString ? `/turmas?${queryString}` : "/turmas";
  };
  const getMobilePageItems = (currentPage: number, totalPages: number) => {
    if (totalPages <= 4) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, currentPage + 1);

    if (currentPage <= 2) {
      start = 1;
      end = 3;
    }

    if (currentPage >= totalPages - 1) {
      start = totalPages - 2;
      end = totalPages;
    }

    const items = Array.from({ length: end - start + 1 }, (_, index) => start + index);

    if (start > 1 && end < totalPages) {
      return [...items, "ellipsis"];
    }

    if (start > 1) {
      return ["ellipsis", ...items];
    }

    if (end < totalPages) {
      return [...items, "ellipsis"];
    }

    return items;
  };
  const mobilePageItems = getMobilePageItems(currentPage, totalPages);

  return (
    <AppShell active="turmas">
      <main className="main-content mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 sm:px-6 lg:gap-8 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <GraduationCap className="size-3.5" /> Coordenação
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Turmas</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">Consulte turmas, acompanhe os alunos e aceda aos registos escolares.</p>
          </div>
          <Button variant="outline" render={<Link href="/" />}>
            <ArrowLeft /> Voltar ao início
          </Button>
        </header>

        {(role === "ADMIN" || role === "DIRECCAO") && <TopTurmasMonthlyRanking />}

        <section aria-label="Resumo de turmas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Turmas", value: turmas.length, detail: "Disponíveis na escola", icon: BookOpen },
            { label: "Alunos", value: totalStudents, detail: "Inscritos nas turmas", icon: Users },
            { label: "Média por turma", value: averageStudents, detail: "Alunos por turma", icon: GraduationCap },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-sm font-medium">{stat.label}</CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums tracking-tight">{stat.value.toLocaleString("pt-AO")}</CardTitle>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">{stat.detail}</CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base"><Search className="size-4 text-primary" /> Pesquisar aluno</CardTitle>
              <CardDescription>Encontre um aluno em todas as turmas supervisionadas.</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit">Pesquisa global</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <form method="get" className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="global-student-search" className="sr-only">Nome do aluno</Label>
                <Input id="global-student-search" name="student" type="search" minLength={2} defaultValue={studentQuery} placeholder="Introduza o nome do aluno…" />
                {query && <input type="hidden" name="q" value={query} />}
              </div>
              <Button type="submit" className="sm:self-start"><Search /> Pesquisar aluno</Button>
              {studentQuery && (
                <Button type="button" variant="ghost" render={<Link href={query ? `/turmas?q=${encodeURIComponent(query)}` : "/turmas"} />}>
                  Limpar
                </Button>
              )}
            </form>
            {studentQuery.length === 1 && <p className="text-sm text-muted-foreground">Introduza pelo menos 2 caracteres para pesquisar.</p>}
            {studentQuery.length >= 2 && (
              <div className="rounded-lg border bg-muted/30 p-4" aria-live="polite">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{matchingStudents.length ? `${matchingStudents.length} aluno(s) encontrado(s)` : "Nenhum aluno encontrado"}</p>
                  {matchingStudents.length > 0 && <Badge variant="secondary">{matchingStudents.length} resultados</Badge>}
                </div>
                {matchingStudents.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {matchingStudents.map((student) => (
                      <li key={`${student.turmaId}-${student.id}`}>
                        <Link href={`/turmas/${student.turmaId}/${encodeURIComponent(student.id)}`} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="min-w-0 truncate font-medium">{student.name}</span>
                          <Badge variant="outline" className="shrink-0">{student.turmaName}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="space-y-4" aria-labelledby="turmas-list-title">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="turmas-list-title" className="text-lg font-semibold tracking-tight">Gestão de turmas</h2>
                <Badge variant="secondary">{turmas.length} {turmas.length === 1 ? "turma" : "turmas"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Abra uma turma para consultar os alunos e os registos.</p>
            </div>
            {role === "ADMIN" && <TurmasActions isAdmin />}
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end sm:justify-between">
              <form method="get" className="grid min-w-0 flex-1 gap-2 sm:max-w-xl">
                <Label htmlFor="turma-search">Pesquisar turma</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="turma-search" name="q" type="search" defaultValue={query} placeholder="Ex.: 10CEJ" />
                  <Button type="submit" variant="secondary"><Search /> Pesquisar</Button>
                  {query && <Button type="button" variant="ghost" render={<Link href="/turmas" />}>Limpar</Button>}
                </div>
              </form>
              <p className="shrink-0 text-sm text-muted-foreground" aria-live="polite">
                {visibleTurmas.length ? `A mostrar ${startIndex + 1}–${Math.min(startIndex + visibleTurmas.length, turmas.length)} de ${turmas.length}` : "Nenhuma turma encontrada"}
              </p>
            </CardContent>
          </Card>

          {visibleTurmas.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleTurmas.map((turma) => {
                const subjects = turma.subjects.filter((subject) => subject.trim());
                return (
                  <article key={turma.id} className="group relative min-w-0">
                    <Link href={`/turmas/${turma.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <Card className="h-full min-h-56 border-border/70 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                        <CardHeader className="space-y-3 pr-14">
                          <Badge variant="outline" className="w-fit gap-1.5"><BookOpen className="size-3.5" /> Turma</Badge>
                          <div className="space-y-1">
                            <CardTitle className="text-xl font-semibold tracking-tight">{turma.name}</CardTitle>
                            <CardDescription>{subjects.length ? `${subjects.length} disciplinas associadas` : "Disciplinas por configurar"}</CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto space-y-4">
                          <div className={`grid gap-3 ${role === "ADMIN" ? "grid-cols-2" : "grid-cols-1"}`}>
                            <div className="rounded-lg bg-muted/60 p-3">
                              <p className="text-xs font-medium text-muted-foreground">Alunos</p>
                              <p className="mt-1 text-2xl font-semibold tabular-nums">{turma.students}</p>
                            </div>
                            {role === "ADMIN" && (
                              <div className="rounded-lg bg-muted/60 p-3">
                                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ImageIcon className="size-3.5" /> Avatares</p>
                                <p className="mt-1 text-2xl font-semibold tabular-nums">{turma.avatarCoverage}%</p>
                              </div>
                            )}
                          </div>
                          <div className="flex min-h-7 flex-wrap gap-1.5" aria-label={`Disciplinas da turma ${turma.name}`}>
                            {subjects.length ? subjects.slice(0, 4).map((subject) => <Badge key={subject} variant="secondary" className="max-w-full truncate">{subject}</Badge>) : <Badge variant="outline">Sem disciplinas</Badge>}
                            {subjects.length > 4 && <Badge variant="outline">+{subjects.length - 4}</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                    {role === "ADMIN" && (
                      <div className="absolute right-3 top-3 z-10">
                        <TurmaDeleteAction turmaId={turma.id} turmaName={turma.name} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><BookOpen className="size-5" /></span>
                <div className="space-y-1">
                  <h3 className="font-semibold">{query ? "Nenhuma turma encontrada" : "Ainda não existem turmas"}</h3>
                  <p className="max-w-md text-sm text-muted-foreground">{query ? "Experimente outro nome ou limpe a pesquisa para ver todas as turmas." : "As turmas disponíveis para a sua conta aparecerão aqui."}</p>
                </div>
                {query && <Button variant="outline" render={<Link href="/turmas" />}>Limpar pesquisa</Button>}
              </CardContent>
            </Card>
          )}
        </section>

        {totalPages > 1 && (
          <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginação de turmas">
            <Button
              variant="outline"
              render={<Link href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)} aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined} />}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
            >
              <ArrowLeft /> Anterior
            </Button>
            <div className="flex items-center gap-1" aria-label="Páginas de turmas">
              {mobilePageItems.map((page, index) => typeof page === "number" ? (
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
      </main>
    </AppShell>
  );
}
