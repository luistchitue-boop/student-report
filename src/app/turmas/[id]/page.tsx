import Link from "next/link";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById, buildStudentSlug } from "@/lib/teacher-data";

export default async function TurmaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const turma = await getCoordinatorTurmaById(session.user.id, id);

  if (!turma) {
    notFound();
  }

  return (
    <AppShell active="turmas">
      <main className="main-content" style={{ maxWidth: 980 }}>
        <header className="topbar" style={{ marginBottom: "1.75rem" }}>
          <div>
            <p className="eyebrow">ALUNOS</p>
            <h1 style={{ fontSize: "2rem", letterSpacing: "-0.05em" }}>{turma.name}</h1>
          </div>
          <Link href="/turmas" style={{ textDecoration: "none", color: "#39755d", fontWeight: 800 }}>
            ← Voltar às turmas
          </Link>
        </header>

        <section style={{ background: "#fff", border: "1px solid #dfe5df", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div>
              <div className="eyebrow">DISPONIBILIDADE</div>
              <strong>{turma.schedule}</strong>
            </div>
            <span style={{ background: "#e2efe7", color: "#39755d", fontWeight: 800, padding: "0.45rem 0.7rem", borderRadius: 999 }}>
              {turma.students} alunos
            </span>
          </div>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            {turma.roster.map((student) => (
              <Link key={student.id} href={`/turmas/${turma.id}/${encodeURIComponent(buildStudentSlug(student.name))}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", background: "#f7f8f4", border: "1px solid #e0e5de", padding: "0.9rem 1rem", flexWrap: "wrap", cursor: "pointer" }}>
                  <div>
                    <strong style={{ display: "block" }}>{student.name}</strong>
                    <small style={{ color: "#68756d" }}>{student.age} anos</small>
                  </div>
                  <span style={{ background: student.attendance === "P" ? "#eaf5ea" : student.attendance === "F" ? "#f7e7e3" : "#f6f0d7", color: "#37433d", borderRadius: 999, padding: "0.35rem 0.7rem", fontSize: "0.75rem", fontWeight: 800 }}>
                    {student.attendance === "P" ? "Presente" : student.attendance === "F" ? "Ausente" : student.attendance}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
