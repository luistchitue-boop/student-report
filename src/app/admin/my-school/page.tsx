import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { getSchoolContext } from "@/lib/school-context";
import { AdminRouteNav } from "../admin-route-nav";
import { MySchoolManager } from "./my-school-manager";

export default async function MySchoolPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Administração" title="Minha escola" description="Edite os dados, o logótipo e as mensagens dos relatórios da escola ativa." icon={Building2} />
        <AdminRouteNav current="my-school" />
        <MySchoolManager />
      </main>
    </AppShell>
  );
}
