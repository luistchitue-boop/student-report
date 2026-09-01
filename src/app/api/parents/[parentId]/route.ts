import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const { parentId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return Response.json({ message: "Não autorizado" }, { status: 401 });
    }

    // Get the parent to find the student and turma
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      select: { studentId: true },
    });

    if (!parent) {
      return Response.json({ message: "Encarregado não encontrado" }, { status: 404 });
    }

    // Verify the student belongs to a turma of this coordinator
    const student = await prisma.student.findUnique({
      where: { id: parent.studentId },
      select: { turmaId: true },
    });

    if (!student) {
      return Response.json({ message: "Aluno não encontrado" }, { status: 404 });
    }

    const turma = await prisma.turma.findFirst({
      where: { id: student.turmaId, coordinator: { userId: session.user.id } },
      select: { id: true },
    });

    if (!turma) {
      return Response.json(
        { message: "Sem permissão para editar este encarregado" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!name || !phone) {
      return Response.json(
        { message: "Nome e telefone são obrigatórios" },
        { status: 400 }
      );
    }

    const updatedParent = await prisma.parent.update({
      where: { id: parentId },
      data: { name, phone, email },
      select: { id: true, name: true, phone: true, email: true },
    });

    return Response.json(updatedParent);
  } catch (error) {
    console.error("Error updating parent:", error);
    return Response.json(
      { message: "Erro ao guardar os dados do encarregado" },
      { status: 500 }
    );
  }
}
