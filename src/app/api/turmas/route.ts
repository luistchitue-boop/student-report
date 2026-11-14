import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const educationType = body.educationType;

    if (!name) {
      return NextResponse.json({ error: "O nome da turma é obrigatório." }, { status: 400 });
    }
    if (educationType !== "ENSINO_GERAL" && educationType !== "ENSINO_TECNICO") {
      return NextResponse.json({ error: "Selecione um tipo de ensino válido para a turma." }, { status: 400 });
    }

    const turma = await prisma.turma.create({
      data: {
        schoolId: schoolContext.schoolId,
        name,
        educationType,
      },
    });

    return NextResponse.json({ success: true, turma }, { status: 201 });
  } catch (error) {
    console.error("Turma creation error:", error);
    return NextResponse.json({ error: "Não foi possível criar a turma." }, { status: 500 });
  }
}
