import { auth } from "@/auth";
import { getSchoolContext, ACTIVE_SCHOOL_COOKIE } from "@/lib/school-context";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

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
  const activationCode = typeof payload.activationCode === "string" ? payload.activationCode.trim().toUpperCase() : "";
  if (!name) return NextResponse.json({ error: "O nome da escola é obrigatório." }, { status: 400 });
  if (!/^SCHOOL-[A-F0-9]{64}$/.test(activationCode)) {
    return NextResponse.json({ error: "Introduza um código de ativação válido." }, { status: 400 });
  }

  const configuredCodes = (process.env.SCHOOL_CREATION_CODES ?? "")
    .split(/[\n,]/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  if (!configuredCodes.length) {
    return NextResponse.json({ error: "A criação de escolas não está configurada. Contacte o suporte." }, { status: 503 });
  }

  const codeHash = createHash("sha256").update(activationCode).digest("hex");
  const configuredCodeHashes = new Set(configuredCodes.map((code) => createHash("sha256").update(code).digest("hex")));
  if (!configuredCodeHashes.has(codeHash)) {
    return NextResponse.json({ error: "O código é inválido ou já foi utilizado." }, { status: 403 });
  }

  try {
    const school = await prisma.$transaction(async (transaction) => {
      const createdSchool = await transaction.school.create({
        data: {
          name,
          address: typeof payload.address === "string" ? payload.address.trim().slice(0, 300) || null : null,
          website: typeof payload.website === "string" ? payload.website.trim().slice(0, 300) || null : null,
          memberships: { create: { userId, role: "ADMIN" } },
        },
        select: { id: true, name: true },
      });

      await transaction.schoolCreationCodeRedemption.create({
        data: { codeHash, schoolId: createdSchool.id, redeemedByUserId: userId },
      });
      return createdSchool;
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
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "O código é inválido ou já foi utilizado." }, { status: 409 });
    }
    console.error("School creation error:", error);
    return NextResponse.json({ error: "Não foi possível registar a escola." }, { status: 500 });
  }
}
