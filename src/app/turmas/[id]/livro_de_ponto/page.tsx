import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";
import { AttendanceBookClient } from "./attendance-book-client";

export default async function AttendanceBookPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;
  let turma = await getCoordinatorTurmaById(session.user.id, id);
  if (!turma) notFound();

  // Filter out inactive students
  turma = {
    ...turma,
    roster: turma.roster.filter((student: { active: boolean }) => student.active),
  };

  return (
    <AppShell active="turmas">
      <AttendanceBookClient turma={turma} />
    </AppShell>
  );
}
