import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get("periodKey") ?? "";
  const turmaIds = searchParams.getAll("turmaId").filter(Boolean);
  const period = getWeeklyCoordinationPeriods(new Date().getFullYear()).find((item) => item.key === periodKey);
  if (!period || period.start > new Date()) return NextResponse.json({ error: "Período semanal inválido." }, { status: 400 });
  if (!turmaIds.length) return NextResponse.json({ completeness: [] });

  const term = `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}`;
  const turmas = await prisma.turma.findMany({
    where: { id: { in: turmaIds } },
    select: {
      id: true,
      name: true,
      subjects: { select: { name: true }, orderBy: { name: "asc" } },
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

  const completeness = turmas.map((turma) => {
    const gradedSubjects = new Set(turma.students.flatMap((student) => student.grades.map((grade) => grade.subject)));
    const missingSubjects = turma.subjects.map((subject) => subject.name).filter((subject) => !gradedSubjects.has(subject));
    const missingBehaviorStudents = turma.students.filter((student) => !student.weeklyObservations[0]?.behavior?.trim()).map((student) => ({ id: student.id, name: student.name }));
    return {
      turmaId: turma.id,
      turmaName: turma.name,
      subjectCount: turma.subjects.length,
      missingSubjects,
      activeStudentCount: turma.students.length,
      missingBehaviorStudents,
      complete: missingSubjects.length === 0 && missingBehaviorStudents.length === 0,
    };
  });

  return NextResponse.json({ completeness });
}