import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if ((session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "O nome da turma é obrigatório." }, { status: 400 });
    }

    const turma = await prisma.turma.create({
      data: {
        name,
      },
    });

    return NextResponse.json({ success: true, turma }, { status: 201 });
  } catch (error) {
    console.error("Turma creation error:", error);
    return NextResponse.json({ error: "Não foi possível criar a turma." }, { status: 500 });
  }
}
