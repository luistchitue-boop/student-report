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
        <nav className="admin-route-tabs" aria-label="Administração de estágio">
          <Link href="/admin/internships">Configurar turmas</Link>
          <span className="active" aria-current="page">Relatórios e envios</span>
        </nav>
        <InternshipReportsAdminClient />
      </main>
    </AppShell>
  );
}
