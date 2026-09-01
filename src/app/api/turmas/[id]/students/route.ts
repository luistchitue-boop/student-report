import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

type ParentInput = { name?: unknown; phone?: unknown; email?: unknown };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: turmaId } = await params;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const age = body.age === "" || body.age === undefined ? null : Number(body.age);
    const parents: ParentInput[] = Array.isArray(body.parents) ? body.parents : [];

    if (!name) return NextResponse.json({ error: "O nome do aluno é obrigatório." }, { status: 400 });
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) return NextResponse.json({ error: "A idade deve ser válida." }, { status: 400 });

    const validParents = parents
      .map((parent) => ({
        name: typeof parent.name === "string" ? parent.name.trim() : "",
        phone: typeof parent.phone === "string" ? parent.phone.trim() : "",
        email: typeof parent.email === "string" ? parent.email.trim() : "",
      }))
      .filter((parent) => parent.name || parent.phone || parent.email);

    if (!validParents.length || validParents.some((parent) => !parent.name || !parent.phone)) {
      return NextResponse.json({ error: "Preencha o nome e telefone de pelo menos um encarregado." }, { status: 400 });
    }

    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";

    const turma = await prisma.turma.findFirst({
      where: isAdmin ? { id: turmaId } : { id: turmaId, coordinator: { userId: session.user.id } },
      select: { id: true },
    });
    if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });

    const student = await prisma.student.create({
      data: {
        turmaId: turma.id,
        name,
        age,
        parents: { create: validParents },
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, student }, { status: 201 });
  } catch (error) {
    console.error("Student creation error:", error);
    return NextResponse.json({ error: "Não foi possível registar o aluno." }, { status: 500 });
  }
}
