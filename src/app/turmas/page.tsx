import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import TurmaDeleteAction from "./turma-delete-action";
import TurmasActions from "./turmas-actions";

const PAGE_SIZE = 6;

export default async function TurmasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const turmas = await getCoordinatorTurmas(session.user.id);
  const rawPage = (await searchParams)?.page;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1");
  const totalPages = Math.max(1, Math.ceil(turmas.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleTurmas = turmas.slice(startIndex, startIndex + PAGE_SIZE);
  const totalStudents = turmas.reduce((sum, turma) => sum + turma.students, 0);
  const averageStudents = turmas.length ? Math.round(totalStudents / turmas.length) : 0;

  const buildPageHref = (page: number) => (page === 1 ? "/turmas" : `/turmas?page=${page}`);
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
      <main className="main-content turma-page-shell">
        <header className="topbar turma-topbar">
          <div>
            <p className="eyebrow">COORDENAÇÃO</p>
            <h1>Turmas</h1>
          </div>
          <Link href="/" className="dashboard-link">
            ← Voltar ao dashboard
          </Link>
        </header>

        <section className="turma-summary" aria-label="Resumo de turmas">
          <div className="summary-card">
            <span className="summary-label">Turmas ativas</span>
            <strong>{turmas.length}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Alunos</span>
            <strong>{totalStudents}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Média por turma</span>
            <strong>{averageStudents}</strong>
          </div>
        </section>

        <section className="turma-toolbar" aria-label="Navegação de turmas">
          <div>
            <p className="eyebrow">VISÃO GERAL</p>
            <h2>Gestão de turmas</h2>
          </div>

          <div className="turma-toolbar-actions">
            <div className="page-meta">
              {visibleTurmas.length ? `Mostrando ${startIndex + 1}-${Math.min(startIndex + visibleTurmas.length, turmas.length)} de ${turmas.length}` : "Nenhuma turma encontrada"}
            </div>
            <TurmasActions isAdmin={session.user.role === "ADMIN"} />
          </div>
        </section>

        <section className="turma-list">
          {visibleTurmas.map((turma) => {
            const subjectSlots = Array.from({ length: 4 }, (_, index) => turma.subjects[index] ?? "—");

            return (
              <div key={turma.id} className="turma-card-wrap">
                <Link href={`/turmas/${turma.id}`} className="turma-card-link">
                  <article className="turma-card">
                    <div className="turma-card-header">
                      <span className="turma-badge">Turma</span>
                      <strong>{turma.name}</strong>
                    </div>

                    <div className="turma-card-body">
                      <div className="metric-row">
                        <span className="metric-label">Alunos</span>
                        <span className="metric-value">{turma.students}</span>
                      </div>
                    </div>

                    <div className="subject-list" aria-label={`Disciplinas da turma ${turma.name}`}>
                      {subjectSlots.map((subject, index) => (
                        <span
                          key={`${turma.id}-${subject}-${index}`}
                          className={subject === "—" ? "subject-pill empty" : "subject-pill"}
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </article>
                </Link>

                {session.user.role === "ADMIN" && (
                  <TurmaDeleteAction turmaId={turma.id} turmaName={turma.name} />
                )}
              </div>
            );
          })}
        </section>

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação de turmas">
            <Link
              href={currentPage === 1 ? buildPageHref(1) : buildPageHref(currentPage - 1)}
              className={currentPage === 1 ? "page-button disabled" : "page-button"}
              aria-disabled={currentPage === 1}
            >
              Anterior
            </Link>

            <div className="pagination-compact" aria-label="Páginas de turmas">
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
