import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem eliminar alunos." }, { status: 403 });

  try {
    const { id: turmaId, studentId } = await params;
    const student = await prisma.student.findFirst({
      where: { id: studentId, turmaId },
      select: { id: true },
    });

    if (!student) return Response.json({ error: "Aluno não encontrado." }, { status: 404 });

    await prisma.student.delete({ where: { id: student.id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Student deletion error:", error);
    return Response.json({ error: "Não foi possível eliminar o aluno." }, { status: 500 });
  }
}