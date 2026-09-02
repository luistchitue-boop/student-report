import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json({ error: "Não foi possível carregar o perfil" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : undefined;
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;

    if (!name && !newPassword) {
      return NextResponse.json(
        { error: "Deve alterar o nome ou a senha" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Senha atual é obrigatória para alterar a senha" },
          { status: 400 }
        );
      }

      if (!user.password) {
        return NextResponse.json(
          { error: "Utilizador não tem senha configurada" },
          { status: 400 }
        );
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Senha atual incorreta" },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "Nova senha deve ter pelo menos 6 caracteres" },
          { status: 400 }
        );
      }
    }

    const updates: { name?: string; password?: string } = {};
    if (name) updates.name = name;
    if (newPassword) {
      updates.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updates,
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({
      success: true,
      message: "Perfil atualizado com sucesso",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Falha ao atualizar perfil" },
      { status: 500 }
    );
  }
}
