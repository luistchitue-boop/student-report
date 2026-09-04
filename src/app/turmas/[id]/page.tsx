import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";
import { StudentCardClient } from "./student-card-client";
import { TurmaDisciplinasClient } from "./disciplinas-client";

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

  const { id } = await params;
  const turma = await getCoordinatorTurmaById(session.user.id, id);

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
      <main className="main-content turma-detail-shell">
        <header className="topbar turma-topbar">
          <div>
            <p className="eyebrow">ALUNOS</p>
            <h1>{turma.name}</h1>
          </div>
          <Link href="/turmas" className="dashboard-link">
            ← Voltar às turmas
          </Link>
        </header>

        <section className="turma-detail-panel">
          <div className="detail-panel-header">
            <div className="detail-panel-actions">
              <span className="detail-count">{turma.students} alunos</span>
              {(session.user.role === "ADMIN" || session.user.role === "COORDENADOR") && (
                <>
                  <Link href={`/turmas/${turma.id}/livro_de_ponto`} className="attendance-book-button">
                    Livro de ponto
                  </Link>
                  <Link href={`/turmas/${turma.id}/mini_pauta`} className="mini-pauta-button">
                    Mini pauta
                  </Link>
                </>
              )}
              <TurmaDisciplinasClient turmaId={turma.id} initialSubjects={turma.subjects} isAdmin={session.user.role === "ADMIN"} />
              <Link href={`/turmas/${turma.id}/novo_aluno`} className="new-student-button">
                Novo aluno
              </Link>
            </div>
          </div>

          <form method="get" className="student-search-form">
            <label htmlFor="student-search">Pesquisar aluno</label>
            <div className="student-search-controls">
              <input id="student-search" name="q" type="search" defaultValue={query} placeholder="Ex.: Alicia Manuela" />
              <button type="submit" className="student-search-button">Pesquisar</button>
              {query && <Link href={`/turmas/${turma.id}`} className="student-search-clear">Limpar</Link>}
            </div>
          </form>

          <div className="student-grid" aria-label={`Lista de alunos da turma ${turma.name}`}>
            {visibleStudents.map((student: { id: string; name: string; age: number; attendance: string; active: boolean; parents: unknown[] }) => (
              <StudentCardClient key={student.id} turmaId={turma.id} student={student} />
            ))}
          </div>
          {!visibleStudents.length && <p className="student-search-empty">Nenhum aluno encontrado.</p>}
        </section>

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação dos alunos da turma">
            <Link
              href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)}
              className={currentPage === 1 ? "page-button disabled" : "page-button"}
              aria-disabled={currentPage === 1}
            >
              Anterior
            </Link>

            <div className="pagination-compact" aria-label="Páginas de alunos">
              {mobilePageItems.map((page, index) =>
                typeof page === "number" ? (
                  <Link
                    key={`${page}-${index}`}
                    href={buildPageHref(page)}
                    className={page === currentPage ? "page-button active" : "page-button"}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Link>
                ) : (
                  <span key={`ellipsis-${index}`} className="page-button page-ellipsis" aria-hidden="true">
                    …
                  </span>
                )
              )}
            </div>

            <Link
              href={currentPage === totalPages ? buildPageHref(totalPages) : buildPageHref(currentPage + 1)}
              className={currentPage === totalPages ? "page-button disabled" : "page-button"}
              aria-disabled={currentPage === totalPages}
            >
              Próxima
            </Link>
          </nav>
        )}
      </main>
    </AppShell>
  );
}
