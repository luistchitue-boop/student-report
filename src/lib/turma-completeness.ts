import { PrismaClient } from "@prisma/client";
import { formatPeriodDate, type WeeklyPeriod } from "@/lib/weekly-coordination";

export async function getTurmaPeriodCompleteness(prisma: PrismaClient, turmaId: string, period: WeeklyPeriod) {
  const term = `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}`;
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: {
      subjects: { select: { name: true } },
      students: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          grades: { where: { term }, select: { subject: true } },
          weeklyObservations: { where: { weekStart: period.start }, select: { behavior: true } },
        },
      },
    },
  });

  if (!turma) return null;
  const gradedSubjects = new Set(turma.students.flatMap((student) => student.grades.map((grade) => grade.subject)));
  const missingSubjects = turma.subjects.map((subject) => subject.name).filter((subject) => !gradedSubjects.has(subject));
  const missingBehaviorStudents = turma.students.filter((student) => !student.weeklyObservations[0]?.behavior?.trim()).map((student) => ({ id: student.id, name: student.name }));

  return {
    subjectCount: turma.subjects.length,
    missingSubjects,
    activeStudentCount: turma.students.length,
    missingBehaviorStudents,
    complete: missingSubjects.length === 0 && missingBehaviorStudents.length === 0,
  };
}
