import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const turmaId = searchParams.get("turmaId") ?? "";
  const monthKeys = [...new Set(searchParams.getAll("month"))].sort();
  if (!turmaId || !monthKeys.length || monthKeys.some((monthKey) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey))) {
    return NextResponse.json({ error: "Turma e pelo menos um mês válido são obrigatórios." }, { status: 400 });
  }

  const selectedMonths = monthKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { key: monthKey, start, end };
  });
  if (selectedMonths.some(({ key, start }) => Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== key)) {
    return NextResponse.json({ error: "Um ou mais meses são inválidos." }, { status: 400 });
  }
  const monthSet = new Set(monthKeys);

  try {
    const role = session.user.role ?? "COORDENADOR";
    const accessFilter = role === "ADMIN"
      ? {}
      : role === "DIRECCAO"
        ? { OR: [
          { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
          { direccaoAssignments: { some: { teacher: { userId: session.user.id } } } },
        ] }
        : { teacherAssignments: { some: { teacher: { userId: session.user.id } } } };

    const turma = await prisma.turma.findFirst({
      where: { id: turmaId, ...accessFilter },
      select: {
        id: true,
        name: true,
        gradeScale: true,
        students: {
          where: { active: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            grades: {
              where: { assessmentType: null, OR: monthKeys.map((monthKey) => ({ term: { startsWith: `Semanal:${monthKey}` } })) },
              select: { subject: true, value: true, term: true },
            },
            absences: {
              where: { OR: selectedMonths.map(({ start, end }) => ({ dia: { gte: start, lt: end } })) },
              select: { justified: true },
            },
          },
        },
      },
    });
    if (!turma) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });

    const weeklyTermPattern = /^Semanal:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
    const students = turma.students.map((student) => {
      const monthGrades = student.grades.filter((grade) => {
        const match = weeklyTermPattern.exec(grade.term);
        return Boolean(match && monthSet.has(match[1].slice(0, 7)));
      });
      const gradeAverage = monthGrades.length
        ? monthGrades.reduce((sum, grade) => sum + Number(grade.value), 0) / monthGrades.length
        : null;
      const justifiedAbsences = student.absences.filter((absence) => absence.justified).length;
      return {
        id: student.id,
        name: student.name,
        avatarUrl: student.avatarUrl,
        gradeAverage: gradeAverage === null ? null : Math.round(gradeAverage * 10) / 10,
        gradeCount: monthGrades.length,
        absenceCount: student.absences.length,
        justifiedAbsenceCount: justifiedAbsences,
        unjustifiedAbsenceCount: student.absences.length - justifiedAbsences,
      };
    });

    const assessedStudents = students.filter((student) => student.gradeAverage !== null);
    const classAverage = assessedStudents.length
      ? assessedStudents.reduce((sum, student) => sum + (student.gradeAverage ?? 0), 0) / assessedStudents.length
      : null;
    const compareBestGrades = (a: typeof students[number], b: typeof students[number]) =>
      (b.gradeAverage ?? 0) - (a.gradeAverage ?? 0) || a.name.localeCompare(b.name, "pt");
    const compareWorstGrades = (a: typeof students[number], b: typeof students[number]) =>
      (a.gradeAverage ?? 0) - (b.gradeAverage ?? 0) || a.name.localeCompare(b.name, "pt");
    const compareFewestAbsences = (a: typeof students[number], b: typeof students[number]) =>
      a.absenceCount - b.absenceCount || a.name.localeCompare(b.name, "pt");
    const compareMostAbsences = (a: typeof students[number], b: typeof students[number]) =>
      b.absenceCount - a.absenceCount || a.name.localeCompare(b.name, "pt");

    return NextResponse.json({
      turmaName: turma.name,
      months: monthKeys,
      gradeScale: turma.gradeScale,
      studentCount: turma.students.length,
      assessedStudentCount: assessedStudents.length,
      classAverage: classAverage === null ? null : Math.round(classAverage * 10) / 10,
      absenceCount: students.reduce((sum, student) => sum + student.absenceCount, 0),
      justifiedAbsenceCount: students.reduce((sum, student) => sum + student.justifiedAbsenceCount, 0),
      unjustifiedAbsenceCount: students.reduce((sum, student) => sum + student.unjustifiedAbsenceCount, 0),
      bestGradeStudents: [...assessedStudents].sort(compareBestGrades).slice(0, 5),
      worstGradeStudents: [...assessedStudents].sort(compareWorstGrades).slice(0, 5),
      fewestAbsenceStudents: [...students].sort(compareFewestAbsences).slice(0, 5),
      mostAbsenceStudents: [...students].sort(compareMostAbsences).slice(0, 5),
    });
  } catch (error) {
    console.error("Turma monthly statistics error:", error);
    return NextResponse.json({ error: "Não foi possível carregar as estatísticas mensais." }, { status: 500 });
  }
}