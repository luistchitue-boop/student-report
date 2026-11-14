import { redirect } from "next/navigation";
import { FileBarChart2 } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import { RelatoriosClient } from "./relatorios-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminRelatoriosPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  const userRole = schoolContext?.role ?? "COORDENADOR";

  if (!session?.user || !schoolContext || (userRole !== "ADMIN" && userRole !== "DIRECCAO")) {
    redirect("/");
  }

  const turmas = await getCoordinatorTurmas(session.user.id);

  return (
    <AppShell active="relatorios">
      <main className="main-content flex flex-col gap-6">
        <PageHeaderCard badge="Administração" title="Enviar relatórios" description="Prepare, pré-visualize e acompanhe os relatórios das turmas." icon={FileBarChart2} />
        <RelatoriosClient turmas={turmas} canSend={userRole === "ADMIN"} />
      </main>
    </AppShell>
  );
}
