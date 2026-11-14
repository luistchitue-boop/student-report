import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { InternshipAdminClient } from "./internship-admin-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function InternshipAdminPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Administração · Estágio" title="Turmas de estágio" description="Configure as turmas que participam no programa de estágio." icon={GraduationCap} />
        <nav className="admin-route-tabs" aria-label="Administração de estágio">
          <span className="active" aria-current="page">Configurar turmas</span>
          <Link href="/admin/internship-reports">Relatórios e envios</Link>
        </nav>
        <InternshipAdminClient />
      </main>
    </AppShell>
  );
}
