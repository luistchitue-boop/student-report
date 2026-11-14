import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { AdminClient } from "./admin-client";
import { AdminRouteNav } from "./admin-route-nav";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Administração" title="Gestão da escola" description="Gira as contas e os acessos da sua escola." icon={ShieldCheck} />
        <AdminRouteNav current="users" />
        <AdminClient allowAdminCreation />
      </main>
    </AppShell>
  );
}
