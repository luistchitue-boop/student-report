import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
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
        <PageHeaderCard badge="Estágio profissional" title="Acompanhamento individual" description="Acompanhe e registe a evolução dos alunos em estágio." icon={GraduationCap} />
        <InternshipReportsClient />
      </main>
    </AppShell>
  );
}
