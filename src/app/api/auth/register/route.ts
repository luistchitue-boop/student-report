import { PrismaClient } from "@prisma/client"
import { hashPassword } from "@/lib/password"
import { NextRequest, NextResponse } from "next/server"

declare global {
  var prismaAuthRegister: PrismaClient | undefined;
}

const prisma = globalThis.prismaAuthRegister ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAuthRegister = prisma;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "O e-mail e a palavra-passe são obrigatórios" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "O utilizador já existe" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    })

    return NextResponse.json(
      { message: "Utilizador criado com sucesso", userId: user.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Não foi possível registar o utilizador" },
      { status: 500 }
    )
  }
}
