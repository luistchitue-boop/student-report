import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") ?? "";
  const monthKey = searchParams.get("month") ?? "";
  if (!studentId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ error: "Aluno e mês válidos são obrigatórios." }, { status: 400 });
  }

  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  if (Number.isNaN(monthStart.getTime()) || monthStart.toISOString().slice(0, 7) !== monthKey) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }

  try {
    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";
    const student = await prisma.student.findFirst({
      where: isAdmin
        ? { id: studentId }
        : { id: studentId, turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } },
      select: { id: true, turma: { select: { gradeScale: true } } },
    });
    if (!student) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });

    const [weeklyGrades, absences] = await Promise.all([
      prisma.grade.findMany({
        where: { studentId: student.id, assessmentType: null, term: { startsWith: "Semanal:" } },
        select: { subject: true, value: true, term: true },
        orderBy: [{ subject: "asc" }, { term: "asc" }],
      }),
      prisma.absence.findMany({
        where: { studentId: student.id, dia: { gte: monthStart, lt: monthEnd } },
        select: { subject: true, justified: true },
      }),
    ]);

    const negativeThreshold = student.turma.gradeScale * 0.5;
    const negativeGrades = weeklyGrades.flatMap((grade) => {
      const match = /^Semanal:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(grade.term);
      if (!match || match[1].slice(0, 7) !== monthKey || Number(grade.value) >= negativeThreshold) return [];
      return [{ subject: grade.subject, value: Number(grade.value), weekStart: match[1], weekEnd: match[2] }];
    });

    const negativeGradesBySubject = Array.from(new Set(negativeGrades.map((grade) => grade.subject))).map((subject) => ({
      subject,
      grades: negativeGrades.filter((grade) => grade.subject === subject).map(({ value, weekStart, weekEnd }) => ({ value, weekStart, weekEnd })),
    }));
    const absencesBySubject = Array.from(new Set(absences.map((absence) => absence.subject))).map((subject) => {
      const subjectAbsences = absences.filter((absence) => absence.subject === subject);
      const justified = subjectAbsences.filter((absence) => absence.justified).length;
      return { subject, total: subjectAbsences.length, justified, unjustified: subjectAbsences.length - justified };
    });

    return NextResponse.json({ month: monthKey, gradeScale: student.turma.gradeScale, negativeThreshold, negativeGradesBySubject, absencesBySubject });
  } catch (error) {
    console.error("Student monthly summary error:", error);
    return NextResponse.json({ error: "Não foi possível carregar o resumo mensal." }, { status: 500 });
  }
}