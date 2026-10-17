import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ADMINISTRAÇÃO</p>
            <h1>Gestão da plataforma</h1>
          </div>
        </header>

        <nav style={{ 
          display: "flex", 
          gap: "16px", 
          padding: "16px 20px",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#fafafa"
        }}>
          <Link href="/admin" style={{
            padding: "8px 16px",
            backgroundColor: "#176b8b",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Utilizadores
          </Link>
          <Link href="/admin/closed-periods" style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            color: "#176b8b",
            textDecoration: "none",
            border: "1px solid #176b8b",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Fecho de períodos
          </Link>
          <Link href="/admin/internships" style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            color: "#176b8b",
            textDecoration: "none",
            border: "1px solid #176b8b",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Turmas de estágio
          </Link>
          <Link href="/admin/internship-reports" style={{
            padding: "8px 16px",
            backgroundColor: "transparent",
            color: "#176b8b",
            textDecoration: "none",
            border: "1px solid #176b8b",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Relatórios de estágio
          </Link>
        </nav>

        <AdminClient />
      </main>
    </AppShell>
  );
}
