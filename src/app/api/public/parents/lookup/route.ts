import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { normalizeParentName } from "@/lib/parent-contact";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name : "";
    const normalizedName = normalizeParentName(rawName);

    if (!normalizedName) {
      return NextResponse.json({ error: "Introduza o nome completo do encarregado." }, { status: 400 });
    }

    const parents = await prisma.parent.findMany({
      where: { student: { active: true } },
      select: { id: true, name: true },
    });

    const matches = parents.filter((parent) => normalizeParentName(parent.name) === normalizedName);

    if (!matches.length) {
      return NextResponse.json({ error: "Nenhum encarregado encontrado com este nome." }, { status: 404 });
    }

    if (matches.length > 1) {
      return NextResponse.json({ error: "Este nome corresponde a mais do que um perfil. Contacte a escola." }, { status: 409 });
    }

    return NextResponse.json({ parentId: matches[0].id });
  } catch (error) {
    console.error("Parent lookup failed:", error);
    return NextResponse.json({ error: "Não foi possível encontrar o perfil." }, { status: 500 });
  }
}
