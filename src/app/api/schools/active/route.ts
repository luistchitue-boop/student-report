import { auth } from "@/auth";
import { ACTIVE_SCHOOL_COOKIE, getSchoolMemberships } from "@/lib/school-context";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

declare global {
  var activeSchoolRoutePrisma: PrismaClient | undefined;
}

const prisma = globalThis.activeSchoolRoutePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.activeSchoolRoutePrisma = prisma;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const memberships = await getSchoolMemberships(userId);
  const activeSchoolId = (await cookies()).get(ACTIVE_SCHOOL_COOKIE)?.value;
  const activeMembership = activeSchoolId
    ? memberships.find((membership) => membership.schoolId === activeSchoolId) ?? null
    : memberships.length === 1 ? memberships[0] : null;

  return NextResponse.json({
    memberships,
    activeSchoolId: activeMembership?.schoolId ?? null,
    role: activeMembership?.role ?? null,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const schoolId = typeof body === "object" && body !== null && "schoolId" in body
    ? (body as { schoolId?: unknown }).schoolId
    : null;
  if (typeof schoolId !== "string" || !schoolId.trim()) {
    return NextResponse.json({ error: "Escola inválida" }, { status: 400 });
  }

  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { schoolId: true, role: true },
  });
  if (!membership) return NextResponse.json({ error: "Sem acesso a esta escola" }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SCHOOL_COOKIE, membership.schoolId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ activeSchoolId: membership.schoolId, role: membership.role });
}
