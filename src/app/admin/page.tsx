import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "./admin-client";
import { getSchoolContext } from "@/lib/school-context";
import { SchoolsManager } from "./schools-manager";

export default async function AdminPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Administração</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gestão da escola</h1>
        </header>

        <nav className="admin-route-tabs" aria-label="Administração">
          <Link className="active" href="/admin">Utilizadores</Link>
          <Link href="/admin/closed-periods">Fecho de períodos</Link>
          <Link href="/admin/internships">Turmas de estágio</Link>
          <Link href="/admin/internship-reports">Relatórios de estágio</Link>
        </nav>

        <SchoolsManager />
        <AdminClient />
      </main>
    </AppShell>
  );
}
