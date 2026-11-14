import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
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
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">RELATÓRIOS</p>
            <h1>Enviar relatórios</h1>
          </div>
        </header>

        <RelatoriosClient turmas={turmas} canSend={userRole === "ADMIN"} />
      </main>
    </AppShell>
  );
}
