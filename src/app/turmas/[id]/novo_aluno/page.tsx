import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";
import { getSchoolContext } from "@/lib/school-context";
import { NewStudentClient } from "./new-student-client";

export default async function NewStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) redirect("/");

  const { id } = await params;
  const turma = await getCoordinatorTurmaById(session.user.id, id);
  if (!turma) notFound();

  return (
    <AppShell active="turmas">
      <NewStudentClient turma={turma} canUploadAvatar={schoolContext.role === "ADMIN"} />
    </AppShell>
  );
}
