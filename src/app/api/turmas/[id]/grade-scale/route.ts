import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem alterar a escala." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { gradeScale?: number; educationType?: "ENSINO_GERAL" | "ENSINO_TECNICO" | null } = {};
    if (Object.prototype.hasOwnProperty.call(body, "gradeScale")) {
      const gradeScale = Number(body.gradeScale);
      if (gradeScale !== 10 && gradeScale !== 20) return Response.json({ error: "A escala deve ser 0-10 ou 0-20." }, { status: 400 });
      data.gradeScale = gradeScale;
    }
    if (Object.prototype.hasOwnProperty.call(body, "educationType")) {
      if (body.educationType !== null && body.educationType !== "ENSINO_GERAL" && body.educationType !== "ENSINO_TECNICO") {
        return Response.json({ error: "Selecione um tipo de ensino válido." }, { status: 400 });
      }
      data.educationType = body.educationType;
    }
    if (!Object.keys(data).length) return Response.json({ error: "Nenhuma classificação da turma foi indicada." }, { status: 400 });

    const turma = await prisma.turma.findFirst({ where: { id, schoolId: schoolContext.schoolId }, select: { id: true } });
    if (!turma) return Response.json({ error: "Turma não encontrada." }, { status: 404 });
    const updatedTurma = await prisma.turma.update({ where: { id }, data, select: { id: true, gradeScale: true, educationType: true } });
    return Response.json(updatedTurma);
  } catch (error) {
    console.error("Grade scale update error:", error);
    return Response.json({ error: "Não foi possível guardar a escala." }, { status: 500 });
  }
}