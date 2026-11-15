import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyParentContactConfirmation } from "@/lib/parent-contact-confirmation";
import { normalizeParentName } from "@/lib/parent-contact";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ parentId: string }> }
) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/encarregado?confirmed=invalid", request.url));
  }

  try {
    const { parentIds: tokenParentIds, phone, email, expiresAt } = verifyParentContactConfirmation(token);
    const { parentId } = await params;

    if (!tokenParentIds.includes(parentId) || expiresAt <= Date.now()) {
      return NextResponse.redirect(new URL("/encarregado?confirmed=invalid", request.url));
    }

    const confirmed = await prisma.$transaction(async (tx) => {
      const parents = await tx.parent.findMany({
        where: { id: { in: tokenParentIds }, student: { active: true, turma: { school: { isActive: true } } } },
        select: { id: true, name: true },
      });
      const normalizedNames = new Set(parents.map((parent) => normalizeParentName(parent.name)));
      if (parents.length !== new Set(tokenParentIds).size || normalizedNames.size !== 1) {
        return false;
      }

      const result = await tx.parent.updateMany({
        where: { id: { in: parents.map((parent) => parent.id) }, student: { active: true, turma: { school: { isActive: true } } } },
        data: { phone, email },
      });
      if (result.count !== parents.length) {
        throw new Error("Parent eligibility changed during confirmation.");
      }
      return true;
    });

    if (!confirmed) {
      return NextResponse.redirect(new URL("/encarregado?confirmed=invalid", request.url));
    }

    return NextResponse.redirect(new URL("/encarregado/confirmado", request.url));
  } catch (error) {
    console.error("Parent contact confirmation failed:", error);
    return NextResponse.redirect(new URL("/encarregado?confirmed=invalid", request.url));
  }
}
