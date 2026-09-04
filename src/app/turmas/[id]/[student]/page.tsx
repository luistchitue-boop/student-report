import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { getCoordinatorStudentBySlug, getCoordinatorTurmaById } from "@/lib/teacher-data";
import { StudentRecordClient } from "./student-record-client";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string; student: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id, student } = await params;
  const turma = await getCoordinatorTurmaById(session.user.id, id);

  if (!turma) {
    notFound();
  }

  const studentRecord = await getCoordinatorStudentBySlug(session.user.id, id, student);

  if (!studentRecord) {
    notFound();
  }

  return <StudentRecordClient turma={turma} student={studentRecord} canEdit={session.user.role === "ADMIN" || session.user.role === "COORDENADOR"} />;
}
