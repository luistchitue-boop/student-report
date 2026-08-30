import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";

export default async function TurmasPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const turmas = await getCoordinatorTurmas(session.user.id);

  return (
    <AppShell active="turmas">
      <main className="main-content" style={{ maxWidth: 980 }}>
        <header className="topbar" style={{ marginBottom: "1.75rem" }}>
          <div>
            <p className="eyebrow">COORDENAÇÃO</p>
            <h1 style={{ fontSize: "2rem", letterSpacing: "-0.05em" }}>Turmas</h1>
          </div>
          <a href="/" style={{ textDecoration: "none", color: "#39755d", fontWeight: 800 }}>
            ← Voltar ao dashboard
          </a>
        </header>

        <section className="turma-list" style={{ display: "grid", gap: "1rem" }}>
          {turmas.map((turma) => (
            <Link key={turma.id} href={`/turmas/${turma.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "#fff", border: "1px solid #dfe5df", borderLeft: "4px solid #39755d", padding: "1rem 1.1rem", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.35rem 0.6rem", background: "#e2efe7", color: "#39755d", borderRadius: 999, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Turma
                  </span>
                  <strong style={{ fontSize: "1.05rem", letterSpacing: "-0.04em" }}>{turma.name}</strong>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", color: "#5d6b63", fontSize: "0.8rem" }}>
                  <span>{turma.students} alunos</span>
                  <span>{turma.schedule}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
