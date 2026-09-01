import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";

const PAGE_SIZE = 10;

export default async function TurmaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] | undefined }>;
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

  const rawPage = (await searchParams)?.page;
  const requestedPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? "1");
  const totalPages = Math.max(1, Math.ceil(turma.roster.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleStudents = turma.roster.slice(startIndex, startIndex + PAGE_SIZE);

  const buildPageHref = (page: number) => (page === 1 ? `/turmas/${turma.id}` : `/turmas/${turma.id}?page=${page}`);

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
            <div>
              <div className="eyebrow">DISPONIBILIDADE</div>
              <strong>{turma.schedule}</strong>
            </div>
            <span className="detail-count">{turma.students} alunos</span>
          </div>

          <div className="student-grid" aria-label={`Lista de alunos da turma ${turma.name}`}>
            {visibleStudents.map((student) => (
              <Link key={student.id} href={`/turmas/${turma.id}/${encodeURIComponent(student.id)}`} className="student-card-link">
                <article className="student-card">
                  <div className="student-avatar-wrap">
                    <span className="student-avatar" aria-hidden="true">👤</span>
                  </div>
                  <div className="student-card-body">
                    <strong>{student.name}</strong>
                    <small>{student.age} anos</small>
                  </div>
                  <span className={`attendance-pill ${student.attendance === "P" ? "present" : student.attendance === "F" ? "absent" : "neutral"}`}>
                    {student.attendance === "P" ? "Activo(a)" : student.attendance === "F" ? "Ausente" : student.attendance}
                  </span>
                </article>
              </Link>
            ))}
          </div>
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
