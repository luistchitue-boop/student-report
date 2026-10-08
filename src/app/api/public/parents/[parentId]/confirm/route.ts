import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyParentContactConfirmation } from "@/lib/parent-contact-confirmation";

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

    await prisma.parent.updateMany({
      where: { id: { in: tokenParentIds } },
      data: { phone, email },
    });

    return NextResponse.redirect(new URL("/encarregado/confirmado", request.url));
  } catch (error) {
    console.error("Parent contact confirmation failed:", error);
    return NextResponse.redirect(new URL("/encarregado?confirmed=invalid", request.url));
  }
}
