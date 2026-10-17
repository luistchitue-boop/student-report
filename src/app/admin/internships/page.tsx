import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipAdminClient } from "./internship-admin-client";

export default async function InternshipAdminPage() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") redirect("/");

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Turmas de estágio</h1></div>
        </header>
        <InternshipAdminClient />
      </main>
    </AppShell>
  );
}
