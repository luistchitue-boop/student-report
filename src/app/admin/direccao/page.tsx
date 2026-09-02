import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "../admin-client";

export default async function AdminDireccaoPage() {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="direccao">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">DIRECÇÃO</p>
            <h1>Gestão da direcção</h1>
          </div>
        </header>

        <AdminClient
          eyebrow="NOVA DIRECÇÃO"
          title="Criar conta de direcção e atribuir turmas"
          defaultRole="DIRECCAO"
        />
      </main>
    </AppShell>
  );
}