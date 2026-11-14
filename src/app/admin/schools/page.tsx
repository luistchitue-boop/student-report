import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { getSchoolContext } from "@/lib/school-context";
import { AdminRouteNav } from "../admin-route-nav";
import { SchoolsManager } from "../schools-manager";

export default async function AdminSchoolsPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Multi-escola" title="Escolas" description="Adicione escolas e mantenha os respetivos dados e acessos separados." icon={Building2} />
        <AdminRouteNav current="schools" />
        <SchoolsManager />
      </main>
    </AppShell>
  );
}