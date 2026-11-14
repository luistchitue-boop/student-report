import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipAdminClient } from "./internship-admin-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function InternshipAdminPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Turmas de estágio</h1></div>
        </header>
        <nav className="admin-route-tabs" aria-label="Administração de estágio">
          <span className="active" aria-current="page">Configurar turmas</span>
          <Link href="/admin/internship-reports">Relatórios e envios</Link>
        </nav>
        <InternshipAdminClient />
      </main>
    </AppShell>
  );
}
