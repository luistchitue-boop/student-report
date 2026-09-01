import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const { id: turmaId, studentId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify the coordinator owns this turma
  const turma = await prisma.turma.findUnique({
    where: { id: turmaId },
    select: { coordinatorId: true },
  });

  if (!turma || turma.coordinatorId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Verify the student belongs to this turma
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { turmaId: true, active: true },
  });

  if (!student || student.turmaId !== turmaId) {
    return notFound();
  }

  // Toggle the active status
  const updatedStudent = await prisma.student.update({
    where: { id: studentId },
    data: { active: !student.active },
    select: { id: true, active: true },
  });

  return Response.json(updatedStudent);
}
