import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { formatPeriodDate, getMonthlyCoordinationPeriods, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await auth();
  const userRole = session?.user?.role ?? "COORDENADOR";
  if (!session?.user || (userRole !== "ADMIN" && userRole !== "DIRECCAO")) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get("periodKey") ?? "";
  const turmaIds = searchParams.getAll("turmaId").filter(Boolean);
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const monthlyPeriods = getMonthlyCoordinationPeriods(new Date().getFullYear());
  const weeklyPeriod = weeklyPeriods.find((item) => item.key === periodKey);
  const monthlyPeriod = monthlyPeriods.find((item) => item.key === periodKey);
  const period = weeklyPeriod ?? monthlyPeriod;
  if (!period || period.start > new Date()) return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  if (!turmaIds.length) return NextResponse.json({ completeness: [] });

  const periodGradeTerms = period.type === "MONTHLY"
    ? weeklyPeriods
        .filter((weeklyPeriodItem) => weeklyPeriodItem.start >= period.start && weeklyPeriodItem.end <= period.end)
        .map((weeklyPeriodItem) => `Semanal:${formatPeriodDate(weeklyPeriodItem.start)}:${formatPeriodDate(weeklyPeriodItem.end)}`)
    : [`Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}`];

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
          grades: { where: { term: { in: periodGradeTerms } }, select: { subject: true } },
          weeklyObservations: { where: { weekStart: { gte: period.start, lte: period.end } }, select: { behavior: true } },
        },
      },
    },
  });

  const completeness = turmas.map((turma) => {
    const gradedSubjects = new Set(turma.students.flatMap((student) => student.grades.map((grade) => grade.subject)));
    const missingSubjects = turma.subjects.map((subject) => subject.name).filter((subject) => !gradedSubjects.has(subject));
    const missingBehaviorStudents = turma.students.filter((student) => !student.weeklyObservations.some((observation) => observation.behavior?.trim())).map((student) => ({ id: student.id, name: student.name }));
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