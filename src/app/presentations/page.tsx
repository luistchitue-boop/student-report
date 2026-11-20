import { redirect } from "next/navigation";
import { Presentation } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { getSchoolContext } from "@/lib/school-context";
import { getCoordinatorPresentationTurmas, hasCoordinatorPresentationAccess } from "@/lib/teacher-data";
import { LessonWorkspaceClient } from "./lesson-workspace-client";

export default async function PresentationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "COORDENADOR") redirect("/");
  if (!await hasCoordinatorPresentationAccess(session.user.id, schoolContext.schoolId)) redirect("/");

  const availableTurmas = await getCoordinatorPresentationTurmas(session.user.id);

  return (
    <AppShell active="presentations">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
        <PageHeaderCard badge="Ferramenta pedagógica" title="Apresentações" description="Escolha um modelo temático, crie os diapositivos e apresente-os com animações interativas." icon={Presentation} />
        <LessonWorkspaceClient turmas={availableTurmas} />
      </main>
    </AppShell>
  );
}
