import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const { id: sourceTurmaId, studentId } = await params;
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
    if (session.user.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem transferir alunos." }, { status: 403 });

    const body = await request.json();
    const destinationTurmaId = typeof body.destinationTurmaId === "string" ? body.destinationTurmaId : "";
    if (!destinationTurmaId || destinationTurmaId === sourceTurmaId) {
      return Response.json({ error: "Selecione uma turma de destino diferente." }, { status: 400 });
    }

    const accessibleTurmas = await prisma.turma.findMany({
      where: { id: { in: [sourceTurmaId, destinationTurmaId] } },
      select: { id: true },
    });
    if (accessibleTurmas.length !== 2) {
      return Response.json({ error: "Turma não encontrada ou sem permissão." }, { status: 403 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, turmaId: sourceTurmaId },
      select: { id: true },
    });
    if (!student) return Response.json({ error: "Aluno não encontrado." }, { status: 404 });

    await prisma.student.update({
      where: { id: studentId },
      data: { turmaId: destinationTurmaId },
    });

    return Response.json({ success: true, turmaId: destinationTurmaId });
  } catch (error) {
    console.error("Error transferring student:", error);
    return Response.json({ error: "Não foi possível transferir o aluno." }, { status: 500 });
  }
}