import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "../admin-client";
import { getSchoolContext } from "@/lib/school-context";
import { Badge } from "@/components/ui/badge";

export default async function AdminDireccaoPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="direccao">
      <main className="main-content flex flex-col gap-6">
        <header className="space-y-2">
          <Badge variant="secondary">ADMINISTRAÇÃO</Badge>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gestão da direção</h1>
            <p className="text-sm text-muted-foreground">Crie contas de direção e gira o acesso às turmas da escola.</p>
          </div>
        </header>

        <AdminClient
          eyebrow="NOVA DIREÇÃO"
          title="Criar conta de direção e atribuir turmas"
          defaultRole="DIRECCAO"
        />
      </main>
    </AppShell>
  );
}