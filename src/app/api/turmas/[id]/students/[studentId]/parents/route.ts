import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ message: "Não autorizado" }, { status: 401 });
    }

    const { id: turmaId, studentId } = await params;
    const role = session.user.role ?? "COORDENADOR";
    if (!["ADMIN", "COORDENADOR", "DIRECCAO"].includes(role)) {
      return Response.json({ message: "Sem permissão para adicionar encarregados" }, { status: 403 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, turmaId },
      select: { id: true, name: true },
    });
    if (!student) {
      return Response.json({ message: "Aluno não encontrado" }, { status: 404 });
    }

    const turma = await prisma.turma.findFirst({
      where: role === "ADMIN"
        ? { id: turmaId }
        : role === "DIRECCAO"
          ? { id: turmaId, direccaoAssignments: { some: { teacher: { userId: session.user.id } } } }
          : { id: turmaId, teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
      select: { id: true },
    });
    if (!turma) {
      return Response.json({ message: "Sem permissão para adicionar encarregados a este aluno" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || !phone) {
      return Response.json({ message: "Nome e telefone são obrigatórios" }, { status: 400 });
    }

    const parent = await prisma.parent.create({
      data: { studentId: student.id, name, phone, email },
      select: { id: true, name: true, phone: true, email: true },
    });

    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Adicionou um encarregado ao aluno",
      entity: "Parent",
      entityId: parent.id,
      details: { studentId: student.id, studentName: student.name },
    });

    return Response.json(parent, { status: 201 });
  } catch (error) {
    console.error("Error creating parent:", error);
    return Response.json({ message: "Erro ao adicionar o encarregado" }, { status: 500 });
  }
}