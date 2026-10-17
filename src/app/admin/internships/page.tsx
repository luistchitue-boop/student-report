import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipAdminClient } from "./internship-admin-client";

export default async function InternshipAdminPage() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Turmas de estágio</h1></div>
        </header>
        <nav aria-label="Administração de estágio" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 20px", borderBottom: "1px solid #e0e7e9", background: "#fafcfc" }}>
          <span aria-current="page" style={{ color: "#173044", fontWeight: 800 }}>Configurar turmas</span>
          <Link href="/admin/internship-reports" style={{ color: "#176b8b", fontWeight: 700 }}>Relatórios e envios</Link>
        </nav>
        <InternshipAdminClient />
      </main>
    </AppShell>
  );
}
