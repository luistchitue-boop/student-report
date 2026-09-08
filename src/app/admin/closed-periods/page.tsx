import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ClosedPeriodsManager } from "./closed-periods-manager";

export default async function ClosedPeriodsPage() {
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
            <h1>Períodos Semanais</h1>
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
            backgroundColor: "transparent",
            color: "#176b8b",
            textDecoration: "none",
            border: "1px solid #176b8b",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Utilizadores
          </Link>
          <Link href="/admin/closed-periods" style={{
            padding: "8px 16px",
            backgroundColor: "#176b8b",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 500
          }}>
            Períodos Semanais
          </Link>
        </nav>

        <ClosedPeriodsManager />
      </main>
    </AppShell>
  );
}
