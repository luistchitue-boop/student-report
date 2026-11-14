import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import { RelatoriosClient } from "./relatorios-client";
import { getSchoolContext } from "@/lib/school-context";
import { Badge } from "@/components/ui/badge";

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
        <header className="space-y-2">
          <Badge variant="secondary">ADMINISTRAÇÃO</Badge>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Enviar relatórios</h1>
            <p className="text-sm text-muted-foreground">Prepare, pré-visualize e acompanhe os relatórios das turmas.</p>
          </div>
        </header>

        <RelatoriosClient turmas={turmas} canSend={userRole === "ADMIN"} />
      </main>
    </AppShell>
  );
}
