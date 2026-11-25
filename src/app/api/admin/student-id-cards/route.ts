import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";
import { generateStudentIdCardsPdf } from "@/lib/student-id-cards-pdf";

const prisma = new PrismaClient();

async function getAdminSchool() {
  const session = await auth();
  if (!session?.user?.id) return { error: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  const context = await getSchoolContext(session.user.id);
  if (!context || context.role !== "ADMIN") return { error: Response.json({ error: "Apenas administradores podem aceder aos cartões da escola ativa." }, { status: 403 }) };
  return { context };
}

export async function GET() {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;
  try {
    const turmas = await prisma.turma.findMany({
      where: { schoolId: admin.context.schoolId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, students: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
    });
    return Response.json({ turmas }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Student ID card roster error:", error);
    return Response.json({ error: "Não foi possível carregar as turmas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;
  try {
    const body = await request.json();
    if (typeof body.turmaId !== "string" || !body.turmaId || (body.studentId != null && (typeof body.studentId !== "string" || !body.studentId))) {
      return Response.json({ error: "Selecione uma turma e um aluno válidos." }, { status: 400 });
    }
    const students = await prisma.student.findMany({
      where: { turmaId: body.turmaId, turma: { schoolId: admin.context.schoolId }, active: true, ...(body.studentId ? { id: body.studentId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarUrl: true, turma: { select: { name: true } } },
    });
    if (!students.length) return Response.json({ error: "Não existem alunos ativos para a seleção indicada." }, { status: 404 });
    const pdf = await generateStudentIdCardsPdf(admin.context.school, students);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="cartoes-de-aluno.pdf"', "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Student ID card PDF error:", error);
    return Response.json({ error: "Não foi possível gerar os cartões de aluno." }, { status: 500 });
  }
}