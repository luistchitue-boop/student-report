import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { getCoordinatorStudentBySlug, getCoordinatorTurmaById } from "@/lib/teacher-data";
import { StudentRecordClient } from "./student-record-client";

export default async function StudentDetailPage({ params, searchParams }: { params: Promise<{ id: string; student: string }>; searchParams: Promise<{ week?: string | string[] }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [{ id, student }, query] = await Promise.all([params, searchParams]);
  const turma = await getCoordinatorTurmaById(session.user.id, id);

  if (!turma) {
    notFound();
  }

  const studentRecord = await getCoordinatorStudentBySlug(session.user.id, id, student);

  if (!studentRecord) {
    notFound();
  }

  const activeRoster = turma.roster.filter((entry: { active: boolean }) => entry.active);
  const currentStudentIndex = activeRoster.findIndex((entry: { id: string }) => entry.id === studentRecord.id);
  const nextStudent = currentStudentIndex >= 0 ? activeRoster[currentStudentIndex + 1] ?? null : null;
  const initialWeek = typeof query.week === "string" ? query.week : "";

  const canAddParent = ["ADMIN", "COORDENADOR", "DIRECCAO"].includes(session.user.role ?? "");

  return <StudentRecordClient turma={turma} student={studentRecord} nextStudent={nextStudent ? { id: nextStudent.id, name: nextStudent.name } : null} initialWeek={initialWeek} canEdit={session.user.role === "ADMIN" || session.user.role === "COORDENADOR"} canAddParent={canAddParent} />;
}
