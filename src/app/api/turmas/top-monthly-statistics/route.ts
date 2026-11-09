import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const role = session.user.role ?? "COORDENADOR";
  if (role !== "ADMIN" && role !== "DIRECCAO") return NextResponse.json({ error: "Sem permissão para consultar esta classificação." }, { status: 403 });

  const monthKey = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  if (Number.isNaN(monthStart.getTime()) || monthStart.toISOString().slice(0, 7) !== monthKey) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }

  try {
    const accessFilter = role === "DIRECCAO"
      ? { OR: [
        { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
        { direccaoAssignments: { some: { teacher: { userId: session.user.id } } } },
      ] }
      : {};
    const turmas = await prisma.turma.findMany({
      where: accessFilter,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        gradeScale: true,
        students: {
          where: { active: true },
          select: {
            grades: { where: { assessmentType: null, term: { startsWith: `Semanal:${monthKey}` } }, select: { value: true, term: true } },
            absences: { where: { dia: { gte: monthStart, lt: nextMonthStart } }, select: { justified: true } },
          },
        },
      },
    });

    const weeklyTermPattern = /^Semanal:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;
    const statistics = turmas.map((turma) => {
      const studentStats = turma.students.map((student) => {
        const monthGrades = student.grades.filter((grade) => {
          const match = weeklyTermPattern.exec(grade.term);
          return match?.[1].slice(0, 7) === monthKey;
        });
        return {
          gradeAverage: monthGrades.length ? monthGrades.reduce((sum, grade) => sum + Number(grade.value), 0) / monthGrades.length : null,
          absenceCount: student.absences.length,
        };
      });
      const assessedStudents = studentStats.filter((student) => student.gradeAverage !== null);
      const average = assessedStudents.length
        ? assessedStudents.reduce((sum, student) => sum + (student.gradeAverage ?? 0), 0) / assessedStudents.length
        : null;
      return {
        id: turma.id,
        name: turma.name,
        gradeScale: turma.gradeScale,
        studentCount: turma.students.length,
        assessedStudentCount: assessedStudents.length,
        average: average === null ? null : Math.round(average * 10) / 10,
        normalizedAverage: average === null ? null : average / turma.gradeScale,
        absenceCount: studentStats.reduce((sum, student) => sum + student.absenceCount, 0),
      };
    });

    const rankedClasses = statistics
      .filter((turma) => turma.normalizedAverage !== null)
      .sort((a, b) => (b.normalizedAverage ?? 0) - (a.normalizedAverage ?? 0) || a.absenceCount - b.absenceCount || a.name.localeCompare(b.name, "pt"))
      .slice(0, 4)
      .map((turma) => ({
        id: turma.id,
        name: turma.name,
        gradeScale: turma.gradeScale,
        studentCount: turma.studentCount,
        assessedStudentCount: turma.assessedStudentCount,
        average: turma.average,
        absenceCount: turma.absenceCount,
      }));

    return NextResponse.json({ month: monthKey, topTurmas: rankedClasses });
  } catch (error) {
    console.error("Top turma monthly statistics error:", error);
    return NextResponse.json({ error: "Não foi possível carregar a classificação das turmas." }, { status: 500 });
  }
}
