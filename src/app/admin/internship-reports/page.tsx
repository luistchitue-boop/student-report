import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { InternshipReportsAdminClient } from "./internship-reports-client";
import { InternshipRouteNav } from "../internships/internship-route-nav";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminInternshipReportsPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Administração · Estágio" title="Relatórios de estágio" description="Acompanhe os relatórios e envios das turmas de estágio." icon={FileText} />
        <InternshipRouteNav current="reports" />
        <InternshipReportsAdminClient />
      </main>
    </AppShell>
  );
}
