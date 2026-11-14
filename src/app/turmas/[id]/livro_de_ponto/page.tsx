import { notFound, redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";
import { AttendanceBookClient } from "./attendance-book-client";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export default async function AttendanceBookPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) redirect("/");

  const { id } = await params;
  let turma = await getCoordinatorTurmaById(session.user.id, id);
  if (!turma) notFound();

  // Filter out inactive students
  turma = {
    ...turma,
    roster: turma.roster.filter((student: { active: boolean }) => student.active),
  };

  const latestAbsenceLog = await prisma.activityLog.findFirst({
    where: { actorId: session.user.id, schoolId: schoolContext.schoolId, entity: "Absence", action: "Registou faltas" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { details: true },
  });
  const details = latestAbsenceLog?.details;
  const detailRecord = details && typeof details === "object" && !Array.isArray(details)
    ? details as Record<string, unknown>
    : null;
  const lastRegisteredAbsence = detailRecord
    && typeof detailRecord.dia === "string"
    && typeof detailRecord.subject === "string"
    && typeof detailRecord.tempo === "string"
    ? { date: detailRecord.dia, subject: detailRecord.subject, tempo: detailRecord.tempo }
    : null;

  return (
    <AppShell active="turmas">
      <AttendanceBookClient turma={turma} lastRegisteredAbsence={lastRegisteredAbsence} />
    </AppShell>
  );
}
