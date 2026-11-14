import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import { StudentCardClient } from "./student-card-client";
import { StudentImportClient } from "./student-import-client";
import { GradeScaleClient } from "./grade-scale-client";
import { TurmaDisciplinasClient } from "./disciplinas-client";
import { TurmaMonthlyStatistics } from "./turma-monthly-statistics";
import { getSchoolContext } from "@/lib/school-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, BookOpenCheck, GraduationCap, Search, UserPlus, Users } from "lucide-react";

const PAGE_SIZE = 10;

export default async function TurmaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] | undefined; q?: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) redirect("/");
  const role = schoolContext.role;

  const { id } = await params;
  const turmas = await getCoordinatorTurmas(session.user.id);
  const turma = turmas.find((candidate) => candidate.id === id);

  if (!turma) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const rawPage = resolvedSearchParams?.page;
  const rawQuery = resolvedSearchParams?.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery ?? "").trim();
  const filteredStudents = query
    ? turma.roster.filter((student: { name: string }) => student.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    : turma.roster;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1");
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleStudents = filteredStudents.slice(startIndex, startIndex + PAGE_SIZE);

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (page > 1) search.set("page", String(page));
    const queryString = search.toString();
    return queryString ? `/turmas/${turma.id}?${queryString}` : `/turmas/${turma.id}`;
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
              <GraduationCap className="size-3.5" /> Turma
            </Badge>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{turma.name}</h1>
              <Badge variant="outline">
                {turma.educationType === "ENSINO_GERAL" ? "Ensino geral" : turma.educationType === "ENSINO_TECNICO" ? "Ensino Técnico" : "Tipo de ensino não definido"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">Consulte os alunos, acompanhe o desempenho e aceda aos registos da turma.</p>
          </div>
          <Button variant="outline" render={<Link href="/turmas" />}><ArrowLeft /> Voltar às turmas</Button>
        </header>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Ferramentas da turma</CardTitle>
              <CardDescription>Atalhos e ações disponíveis para o seu perfil.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit gap-1.5"><Users className="size-3.5" /> {turma.students} {turma.students === 1 ? "aluno" : "alunos"}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 pt-4">
            {(role === "ADMIN" || role === "COORDENADOR") && (
              <>
                <Button variant="outline" render={<Link href={`/turmas/${turma.id}/livro_de_ponto`} />}><BookOpenCheck /> Livro de ponto</Button>
                <Button variant="outline" render={<Link href={`/turmas/${turma.id}/mini_pauta`} />}><BookOpenCheck /> Mini pauta</Button>
              </>
            )}
            <TurmaDisciplinasClient turmaId={turma.id} initialSubjects={turma.subjects} isAdmin={role === "ADMIN"} />
            {role === "ADMIN" && <StudentImportClient turmaId={turma.id} />}
            <Button className="ml-auto" render={<Link href={`/turmas/${turma.id}/novo_aluno`} />}><UserPlus /> Novo aluno</Button>
            {role === "ADMIN" && <GradeScaleClient turmaId={turma.id} initialScale={turma.gradeScale} initialEducationType={turma.educationType} />}
          </CardContent>
        </Card>

        <TurmaMonthlyStatistics turmaId={turma.id} />

        <section className="space-y-4" aria-labelledby="student-directory-title">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <h2 id="student-directory-title" className="text-lg font-semibold tracking-tight">Alunos da turma</h2>
              <p className="text-sm text-muted-foreground">Pesquise e abra um registo individual.</p>
            </div>
            <Badge variant="outline">{filteredStudents.length} {filteredStudents.length === 1 ? "resultado" : "resultados"}</Badge>
          </div>

          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="student-search">Pesquisar aluno</Label>
                  <Input id="student-search" name="q" type="search" defaultValue={query} placeholder="Ex.: Alicia Manuela" />
                </div>
                <Button type="submit"><Search /> Pesquisar</Button>
                {query && <Button type="button" variant="ghost" render={<Link href={`/turmas/${turma.id}`} />}>Limpar</Button>}
              </form>
            </CardContent>
          </Card>

          {visibleStudents.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label={`Lista de alunos da turma ${turma.name}`}>
              {visibleStudents.map((student: { id: string; name: string; age: number; attendance: string; active: boolean; parents: unknown[]; avatarUrl?: string | null }) => (
                <StudentCardClient
                  key={student.id}
                  turmaId={turma.id}
                  student={student}
                  availableTurmas={role === "ADMIN" ? turmas.filter((candidate) => candidate.id !== turma.id).map((candidate) => ({ id: candidate.id, name: candidate.name })) : []}
                  isAdmin={role === "ADMIN"}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="size-5" /></span>
                <div className="space-y-1">
                  <h3 className="font-semibold">{query ? "Nenhum aluno encontrado" : "Ainda não há alunos nesta turma"}</h3>
                  <p className="max-w-md text-sm text-muted-foreground">{query ? "Experimente outro nome ou limpe a pesquisa para ver todos os alunos." : "Os alunos inscritos nesta turma aparecerão aqui."}</p>
                </div>
                {query && <Button variant="outline" render={<Link href={`/turmas/${turma.id}`} />}>Limpar pesquisa</Button>}
              </CardContent>
            </Card>
          )}
        </section>

        {totalPages > 1 && (
          <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginação dos alunos da turma">
            <Button variant="outline" className={currentPage === 1 ? "pointer-events-none opacity-50" : ""} render={<Link href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)} aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined} />}><ArrowLeft /> Anterior</Button>
            <div className="flex items-center gap-1" aria-label="Páginas de alunos">
              {mobilePageItems.map((page, index) => typeof page === "number" ? (
                <Button key={`${page}-${index}`} variant={page === currentPage ? "default" : "ghost"} size="icon" render={<Link href={buildPageHref(page)} aria-current={page === currentPage ? "page" : undefined} aria-label={`Página ${page}`} />}>{page}</Button>
              ) : <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground" aria-hidden="true">…</span>)}
            </div>
            <Button variant="outline" className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""} render={<Link href={currentPage === totalPages ? buildPageHref(totalPages) : buildPageHref(currentPage + 1)} aria-disabled={currentPage === totalPages} tabIndex={currentPage === totalPages ? -1 : undefined} />}>Próxima <ArrowRight /></Button>
          </nav>
        )}
      </main>
    </AppShell>
  );
}
