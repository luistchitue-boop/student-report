import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const turma = await prisma.turma.findUnique({
    where: { id, schoolId: schoolContext.schoolId },
    select: { id: true },
  });

  if (!turma) {
    return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  }

  await prisma.turma.deleteMany({ where: { id, schoolId: schoolContext.schoolId } });

  return NextResponse.json({ success: true });
}
