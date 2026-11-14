import { auth } from "@/auth";
import { getSchoolContext, ACTIVE_SCHOOL_COOKIE } from "@/lib/school-context";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

declare global {
  var schoolsRoutePrisma: PrismaClient | undefined;
}

const prisma = globalThis.schoolsRoutePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.schoolsRoutePrisma = prisma;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const currentContext = await getSchoolContext(userId);
  if (!currentContext || currentContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores de escola podem registar outra escola." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 160) : "";
  if (!name) return NextResponse.json({ error: "O nome da escola é obrigatório." }, { status: 400 });

  try {
    const school = await prisma.school.create({
      data: {
        name,
        address: typeof payload.address === "string" ? payload.address.trim().slice(0, 300) || null : null,
        website: typeof payload.website === "string" ? payload.website.trim().slice(0, 300) || null : null,
        memberships: { create: { userId, role: "ADMIN" } },
      },
      select: { id: true, name: true },
    });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_SCHOOL_COOKIE, school.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ school }, { status: 201 });
  } catch (error) {
    console.error("School creation error:", error);
    return NextResponse.json({ error: "Não foi possível registar a escola." }, { status: 500 });
  }
}
