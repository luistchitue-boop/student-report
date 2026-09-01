import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const { id: turmaId, studentId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ message: "Não autorizado" }, { status: 401 });
    }

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";

    // Verify the coordinator owns this turma
    const turma = await prisma.turma.findFirst({
      where: isAdmin ? { id: turmaId } : { id: turmaId, coordinator: { userId: session.user.id } },
      select: { id: true },
    });

    if (!turma) {
      return Response.json({ message: "Turma não encontrada ou sem permissão" }, { status: 403 });
    }

    // Verify the student belongs to this turma
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { turmaId: true, active: true },
    });

    if (!student || student.turmaId !== turmaId) {
      return Response.json({ message: "Aluno não encontrado" }, { status: 404 });
    }

    // Toggle the active status
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { active: !student.active },
      select: { id: true, active: true },
    });

    return Response.json(updatedStudent);
  } catch (error) {
    console.error("Error toggling student active status:", error);
    return Response.json(
      { message: "Erro ao guardar o estado do aluno" },
      { status: 500 }
    );
  }
}
