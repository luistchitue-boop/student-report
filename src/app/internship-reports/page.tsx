import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipReportsClient } from "./internship-reports-client";

export default async function InternshipReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  if ((session.user.role ?? "COORDENADOR") !== "COORDENADOR") redirect("/");

  return (
    <AppShell active="internships">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">ESTÁGIO PROFISSIONAL</p><h1>Acompanhamento individual</h1></div>
        </header>
        <InternshipReportsClient />
      </main>
    </AppShell>
  );
}
