import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { InternshipReportsClient } from "./internship-reports-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function InternshipReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "COORDENADOR") redirect("/");

  return (
    <AppShell active="internships">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
        <header className="border-b pb-5">
          <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Estágio profissional</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Acompanhamento individual</h1><p className="text-sm text-muted-foreground">Acompanhe e registe a evolução dos alunos em estágio.</p></div>
        </header>
        <InternshipReportsClient />
      </main>
    </AppShell>
  );
}
