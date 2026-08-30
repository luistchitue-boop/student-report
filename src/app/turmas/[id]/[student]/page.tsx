import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { turmas } from "../../page";
import { StudentRecordClient } from "./student-record-client";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string; student: string }> }) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  const { id, student } = await params;
  const turma = turmas.find((entry) => entry.id === id);

  if (!turma) {
    notFound();
  }

  const studentName = student.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const studentRecord = turma.roster.find((entry) => entry.name.toLowerCase() === studentName.toLowerCase());

  if (!studentRecord) {
    notFound();
  }

  return <StudentRecordClient turma={turma} student={studentRecord} />;
}
