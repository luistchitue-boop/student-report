import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const schoolContext = await getSchoolContext(session.user.id);
  return schoolContext?.role === "ADMIN" ? { session, schoolContext } : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  const { schoolContext } = admin;

  try {
    const [turmas, coordinators] = await Promise.all([
      prisma.turma.findMany({
        where: { schoolId: schoolContext.schoolId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          isInternship: true,
          students: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              active: true,
              internshipAssignments: { select: { teacherId: true } },
            },
          },
        },
      }),
      prisma.teacher.findMany({
        where: { user: { schoolMemberships: { some: { schoolId: schoolContext.schoolId, role: "COORDENADOR" } } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, user: { select: { email: true } } },
      }),
    ]);

    return NextResponse.json({
      turmas: turmas.map((turma) => ({
        ...turma,
        students: turma.students.map((student) => ({
          ...student,
          teacherIds: student.internshipAssignments.map((assignment) => assignment.teacherId),
          internshipAssignments: undefined,
        })),
      })),
      coordinators,
    });
  } catch (error) {
    console.error("Internship administration load error:", error);
    return NextResponse.json({ error: "Não foi possível carregar as turmas. Confirme se as migrações de estágio foram aplicadas à base de dados." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  const { session, schoolContext } = admin;

  try {
    const body = await request.json();
    if (body.action === "setTurmaMode") {
      const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
      if (!turmaId || typeof body.isInternship !== "boolean") return NextResponse.json({ error: "Turma e estado de estágio são obrigatórios." }, { status: 400 });
      const currentTurma = await prisma.turma.findFirst({ where: { id: turmaId, schoolId: schoolContext.schoolId }, select: { id: true } });
      if (!currentTurma) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
      const turma = await prisma.turma.update({ where: { id: turmaId }, data: { isInternship: body.isInternship }, select: { id: true, name: true, isInternship: true } });
      try {
        await createActivityLog({ actorId: session.user.id, actorName: describeActorName(session.user), action: body.isInternship ? "Marcou turma como estágio" : "Removeu turma do modo estágio", entity: "Turma", entityId: turma.id, details: { name: turma.name, isInternship: turma.isInternship } });
      } catch (error) {
        console.error("Could not record internship turma activity:", error);
      }
      return NextResponse.json({ success: true, turma });
    }

    if (body.action === "setStudentAssignments") {
      const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const teacherIds: string[] | null = Array.isArray(body.teacherIds) ? [...new Set<string>(body.teacherIds.filter((id: unknown): id is string => typeof id === "string"))] : null;
      if (!turmaId || !studentId || !teacherIds) return NextResponse.json({ error: "Turma, aluno e coordenadores são obrigatórios." }, { status: 400 });

      const [turma, student, teachers] = await Promise.all([
        prisma.turma.findFirst({ where: { id: turmaId, schoolId: schoolContext.schoolId }, select: { id: true, isInternship: true } }),
        prisma.student.findFirst({ where: { id: studentId, turmaId, turma: { schoolId: schoolContext.schoolId } }, select: { id: true } }),
        prisma.teacher.findMany({ where: { id: { in: teacherIds }, user: { schoolMemberships: { some: { schoolId: schoolContext.schoolId, role: "COORDENADOR" } } } }, select: { id: true } }),
      ]);
      if (!turma?.isInternship) return NextResponse.json({ error: "Ative primeiro o modo estágio nesta turma." }, { status: 400 });
      if (!student) return NextResponse.json({ error: "O aluno não pertence a esta turma." }, { status: 400 });
      if (teachers.length !== teacherIds.length) return NextResponse.json({ error: "Um ou mais coordenadores não são válidos." }, { status: 400 });

      await prisma.$transaction(async (transaction) => {
        await transaction.internshipStudentAssignment.deleteMany({ where: { studentId } });
        if (teacherIds.length) await transaction.internshipStudentAssignment.createMany({ data: teacherIds.map((teacherId) => ({ studentId, teacherId })) });
      });
      await createActivityLog({ actorId: session.user.id, actorName: describeActorName(session.user), action: "Atualizou os coordenadores de estágio do aluno", entity: "Student", entityId: studentId, details: { turmaId, teacherIds } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
  } catch (error) {
    console.error("Internship administration error:", error);
    return NextResponse.json({ error: "Não foi possível atualizar a configuração de estágio." }, { status: 500 });
  }
}
