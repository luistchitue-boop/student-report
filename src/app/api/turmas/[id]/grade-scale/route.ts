import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem alterar a escala." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const gradeScale = Number(body.gradeScale);
    if (gradeScale !== 10 && gradeScale !== 20) return Response.json({ error: "A escala deve ser 0-10 ou 0-20." }, { status: 400 });

    const turma = await prisma.turma.update({ where: { id }, data: { gradeScale }, select: { id: true, gradeScale: true } });
    return Response.json(turma);
  } catch (error) {
    console.error("Grade scale update error:", error);
    return Response.json({ error: "Não foi possível guardar a escala." }, { status: 500 });
  }
}