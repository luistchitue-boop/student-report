import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";

declare global {
  var prismaAdminTeachers: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminTeachers ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAdminTeachers = prisma;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const turmaNames = Array.isArray(body.turmaNames) ? body.turmaNames : [];

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nome, email e senha são obrigatórios" }, { status: 400 });
    }

    if (turmaNames.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: await bcrypt.hash(password, 10),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          password: await bcrypt.hash(password, 10),
        },
      });
    }

    let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          name,
          role: "COORDENADOR",
        },
      });
    } else {
      teacher = await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          name,
          role: "COORDENADOR",
        },
      });
    }

    for (const turmaName of turmaNames) {
      if (!turmaName) continue;

      await prisma.turma.updateMany({
        where: { name: turmaName },
        data: { coordinatorId: teacher.id },
      });
    }

    return NextResponse.json({
      message: "Professor criado com sucesso",
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: user.email,
      },
      turmas: turmaNames,
    });
  } catch (error) {
    console.error("Admin teacher creation error:", error);
    return NextResponse.json({ error: "Não foi possível criar o professor" }, { status: 500 });
  }
}
