import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "../admin-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminDireccaoPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="direccao">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">DIREÇÃO</p>
            <h1>Gestão da direção</h1>
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