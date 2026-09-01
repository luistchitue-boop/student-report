import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";

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
          <div className="page-meta">
            {visibleTurmas.length ? `Mostrando ${startIndex + 1}-${Math.min(startIndex + visibleTurmas.length, turmas.length)} de ${turmas.length}` : "Nenhuma turma encontrada"}
          </div>
        </section>

        <section className="turma-list">
          {visibleTurmas.map((turma) => (
            <Link key={turma.id} href={`/turmas/${turma.id}`} className="turma-card-link">
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
                  <div className="metric-row">
                    <span className="metric-label">Horário</span>
                    <span className="metric-value">{turma.schedule}</span>
                  </div>
                </div>

                <div className="subject-list" aria-label={`Disciplinas da turma ${turma.name}`}>
                  {(turma.subjects.length ? turma.subjects : ["Sem disciplinas cadastradas"]).map((subject) => (
                    <span key={`${turma.id}-${subject}`} className="subject-pill">
                      {subject}
                    </span>
                  ))}
                </div>
              </article>
            </Link>
          ))}
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

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Link
                key={page}
                href={buildPageHref(page)}
                className={page === currentPage ? "page-button active" : "page-button"}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </Link>
            ))}

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
