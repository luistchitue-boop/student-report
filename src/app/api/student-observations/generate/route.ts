import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";
import { isTurmaWeeklyPeriodClosed } from "@/lib/closed-periods";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { generateMonthlyComment } from "@/lib/generate-monthly-comment";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const context = await getSchoolContext(session.user.id);
  if (!context || (context.role !== "ADMIN" && context.role !== "COORDENADOR")) {
    return NextResponse.json({ error: "Sem permissão para gerar comentários." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
    const weekEnd = typeof body.weekEnd === "string" ? body.weekEnd : "";
    if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
      return NextResponse.json({ error: "Selecione um aluno e período semanal válido." }, { status: 400 });
    }
    const officialPeriod = getWeeklyCoordinationPeriods(Number(weekStart.slice(0, 4)))
      .find((period) => formatPeriodDate(period.start) === weekStart && formatPeriodDate(period.end) === weekEnd);
    if (!officialPeriod || officialPeriod.start > new Date()) {
      return NextResponse.json({ error: "Selecione um período semanal válido que não seja futuro." }, { status: 400 });
    }
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        turma: {
          schoolId: context.schoolId,
          ...(context.role === "COORDENADOR" ? { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } : {}),
        },
      },
      select: { id: true, turmaId: true, turma: { select: { gradeScale: true } } },
    });
    if (!student) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });
    if (await isTurmaWeeklyPeriodClosed(student.turmaId, officialPeriod.start, officialPeriod.end, prisma)) {
      return NextResponse.json({ error: "Este período está fechado para esta turma." }, { status: 403 });
    }

    const [year, month] = weekStart.slice(0, 7).split("-").map(Number);
    const currentStart = new Date(Date.UTC(year, month - 1, 1));
    const previousStart = new Date(Date.UTC(year, month - 2, 1));
    const currentEnd = new Date(Date.UTC(year, month, 1));
    const currentKey = currentStart.toISOString().slice(0, 7);
    const previousKey = previousStart.toISOString().slice(0, 7);
    const [grades, absences] = await Promise.all([
      prisma.grade.findMany({
        where: { studentId: student.id, assessmentType: null, OR: [{ term: { startsWith: `Semanal:${currentKey}-` } }, { term: { startsWith: `Semanal:${previousKey}-` } }] },
        select: { term: true, value: true },
      }),
      prisma.absence.findMany({
        where: { studentId: student.id, dia: { gte: previousStart, lt: currentEnd } },
        select: { dia: true, justified: true },
      }),
    ]);
    const summarize = (key: string) => {
      const monthlyGrades = grades.filter((grade) => /^Semanal:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(grade.term) && grade.term.slice(8, 15) === key);
      const monthlyAbsences = absences.filter((absence) => absence.dia.toISOString().slice(0, 7) === key);
      return {
        month: key,
        gradeCount: monthlyGrades.length,
        negativeGrades: monthlyGrades.filter((grade) => Number(grade.value) < student.turma.gradeScale * 0.5).length,
        absenceCount: monthlyAbsences.length,
        unjustifiedAbsences: monthlyAbsences.filter((absence) => !absence.justified).length,
      };
    };
    const current = summarize(currentKey);
    const previous = summarize(previousKey);
    if (!current.gradeCount && !current.absenceCount && !previous.gradeCount && !previous.absenceCount) {
      return NextResponse.json({ error: "Não existem notas semanais nem faltas registadas nos dois meses para gerar um comentário." }, { status: 422 });
    }
    const comment = await generateMonthlyComment({ current, previous, gradeScale: student.turma.gradeScale });
    return NextResponse.json({ text: comment }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Student comment generation error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Não foi possível gerar o comentário. Confirme a configuração de IA e tente novamente." }, { status: 503 });
  }
}
