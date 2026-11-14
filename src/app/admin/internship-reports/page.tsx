import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipReportsAdminClient } from "./internship-reports-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminInternshipReportsPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRAÇÃO · ESTÁGIO</p><h1>Relatórios de estágio</h1></div>
        </header>
        <nav aria-label="Administração de estágio" style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 20px", borderBottom: "1px solid #e0e7e9", background: "#fafcfc" }}>
          <Link href="/admin/internships" style={{ color: "#176b8b", fontWeight: 700 }}>Configurar turmas</Link>
          <span aria-current="page" style={{ color: "#173044", fontWeight: 800 }}>Relatórios e envios</span>
        </nav>
        <InternshipReportsAdminClient />
      </main>
    </AppShell>
  );
}
