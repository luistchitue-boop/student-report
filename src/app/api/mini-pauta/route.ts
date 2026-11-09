import { NextRequest, NextResponse } from "next/server";
import { GradeAssessmentType, PrismaClient, Trimester } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { isTurmaWeeklyPeriodClosed } from "@/lib/closed-periods";

const prisma = new PrismaClient();

function isValidDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function parseGradeClassification(assessmentType: unknown, trimester: unknown, educationType: string | null) {
  const normalizedType = assessmentType === "" || assessmentType === undefined || assessmentType === null ? null : assessmentType;
  const normalizedTrimester = trimester === "" || trimester === undefined || trimester === null ? null : trimester;
  if (normalizedType === null) {
    return normalizedTrimester === null ? { assessmentType: null, trimester: null } : null;
  }
  if (!Object.values(GradeAssessmentType).includes(normalizedType as GradeAssessmentType)) return null;
  if (!Object.values(Trimester).includes(normalizedTrimester as Trimester)) return null;
  if (normalizedType === GradeAssessmentType.AC2 && educationType !== "ENSINO_GERAL") return null;
  if (normalizedType === GradeAssessmentType.NPP && educationType !== "ENSINO_TECNICO") return null;
  return { assessmentType: normalizedType as GradeAssessmentType, trimester: normalizedTrimester as Trimester };
}

async function getAuthorizedTurma(userId: string, turmaId: string, userRole?: string) {
  const isAdmin = userRole === "ADMIN";

  return prisma.turma.findFirst({
    where: isAdmin ? { id: turmaId } : { id: turmaId, teacherAssignments: { some: { teacher: { userId } } } },
    include: {
      subjects: { orderBy: { name: "asc" }, select: { name: true } },
      students: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, age: true } },
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const turmaId = searchParams.get("turmaId") ?? "";
  const subject = searchParams.get("subject") ?? "";
  const weekStart = searchParams.get("weekStart") ?? "";
  const weekEnd = searchParams.get("weekEnd") ?? "";
  const exportMode = searchParams.get("export") === "true";
  const assessmentType = searchParams.get("assessmentType");
  const trimester = searchParams.get("trimester");

  if (!turmaId || !subject || !weekStart || !weekEnd || !isValidDate(weekStart) || !isValidDate(weekEnd)) {
    return NextResponse.json({ error: "Turma, subject, and a valid weekly interval are required" }, { status: 400 });
  }

  const turma = await getAuthorizedTurma(session.user.id, turmaId, session.user.role ?? "COORDENADOR");
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });
  const classification = parseGradeClassification(assessmentType, trimester, turma.educationType);
  if (!classification) return NextResponse.json({ error: "O tipo de nota não corresponde ao ensino da turma ou falta selecionar o trimestre." }, { status: 400 });

  const term = `Semanal:${weekStart}:${weekEnd}`;
  const startDate = new Date(`${weekStart}T00:00:00Z`);
  const endDate = new Date(`${weekEnd}T23:59:59.999Z`);
  const grades = await prisma.grade.findMany({
    where: exportMode
      ? { studentId: { in: turma.students.map((student) => student.id) }, subject, createdAt: { gte: startDate, lte: endDate }, ...classification }
      : { studentId: { in: turma.students.map((student) => student.id) }, subject, term, ...classification },
    select: { studentId: true, value: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ students: turma.students, subjects: turma.subjects.map((entry) => entry.name), gradeScale: turma.gradeScale, grades, alreadyRecorded: grades.length > 0 });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") return NextResponse.json({ error: "Sem permissão para usar a mini pauta." }, { status: 403 });

  try {
    const body = await request.json();
    const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const weekStart = typeof body.weekStart === "string" ? body.weekStart : "";
    const weekEnd = typeof body.weekEnd === "string" ? body.weekEnd : "";
    const grades = Array.isArray(body.grades) ? body.grades : [];

    if (!turmaId || !subject || !weekStart || !weekEnd || !isValidDate(weekStart) || !isValidDate(weekEnd)) {
      return NextResponse.json({ error: "Turma, subject, and a valid weekly interval are required" }, { status: 400 });
    }

    const start = new Date(`${weekStart}T12:00:00Z`);
    const officialPeriod = getWeeklyCoordinationPeriods(start.getUTCFullYear()).find((period) => period.key === formatPeriodDate(start) && formatPeriodDate(period.end) === weekEnd);
    if (!officialPeriod) return NextResponse.json({ error: "Selecione um período semanal válido." }, { status: 400 });
    if (officialPeriod.key > formatPeriodDate(new Date())) {
      return NextResponse.json({ error: "Não é possível registar notas num período semanal futuro." }, { status: 400 });
    }

    const turma = await getAuthorizedTurma(session.user.id, turmaId, session.user.role ?? "COORDENADOR");
    if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });
    const classification = parseGradeClassification(body.assessmentType, body.trimester, turma.educationType);
    if (!classification) return NextResponse.json({ error: "O tipo de nota não corresponde ao ensino da turma ou falta selecionar o trimestre." }, { status: 400 });

    const periodClosed = await isTurmaWeeklyPeriodClosed(turmaId, officialPeriod.start, officialPeriod.end, prisma);
    if (periodClosed) {
      return NextResponse.json({ error: "Este período semanal está fechado. Não é possível registar notas." }, { status: 403 });
    }

    if (!turma.subjects.some((entry) => entry.name === subject)) return NextResponse.json({ error: "Subject does not belong to this turma" }, { status: 400 });

    const turmaStudentIds = new Set(turma.students.map((student) => student.id));
    const validGrades: Array<{ studentId: string; value: number }> = grades.flatMap((entry: { studentId?: unknown; value?: unknown }) => {
      if (typeof entry.studentId !== "string" || !turmaStudentIds.has(entry.studentId)) return [];
      const value = Number(entry.value);
      return Number.isFinite(value) && value >= 0 && value <= turma.gradeScale ? [{ studentId: entry.studentId, value }] : [];
    });
    const term = `Semanal:${weekStart}:${weekEnd}`;

    await prisma.$transaction(async (tx) => {
      for (const entry of validGrades) {
        const existing = await tx.grade.findFirst({
          where: { studentId: entry.studentId, subject, term, ...classification },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (existing) {
          await tx.grade.update({ where: { id: existing.id }, data: { value: entry.value } });
        } else {
          await tx.grade.create({
            data: { studentId: entry.studentId, subject, value: entry.value, term, ...classification },
          });
        }
      }
    });

    if (validGrades.length) {
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: "Registou notas",
        entity: "Grade",
        entityId: null,
        details: {
          turmaId,
          subject,
          term,
          assessmentType: classification.assessmentType,
          trimester: classification.trimester,
          studentIds: validGrades.map((entry) => entry.studentId),
          values: validGrades,
        },
      });
    }

    return NextResponse.json({ success: true, saved: validGrades.length, unchangedWhenBlank: true });
  } catch (error) {
    console.error("Mini pauta save error:", error);
    return NextResponse.json({ error: "Não foi possível guardar a mini pauta" }, { status: 500 });
  }
}
