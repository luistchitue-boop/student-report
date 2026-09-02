import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if ((session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const turma = await prisma.turma.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!turma) {
    return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  }

  await prisma.turma.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
