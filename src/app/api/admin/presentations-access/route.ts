import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { getSchoolContext } from "@/lib/school-context";

declare global {
  var adminPresentationAccessPrisma: PrismaClient | undefined;
}

const prisma = globalThis.adminPresentationAccessPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.adminPresentationAccessPrisma = prisma;

async function requireSchoolAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") return null;
  return { session, schoolContext };
}

export async function GET() {
  const admin = await requireSchoolAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });

  const coordinators = await prisma.schoolMembership.findMany({
    where: { schoolId: admin.schoolContext.schoolId, role: "COORDENADOR" },
    orderBy: [{ user: { name: "asc" } }, { userId: "asc" }],
    select: {
      userId: true,
      user: { select: { name: true, email: true } },
      presentationAccess: { select: { schoolId: true } },
    },
  });

  return NextResponse.json({
    coordinators: coordinators.map(({ userId, user, presentationAccess }) => ({
      userId,
      name: user.name || user.email,
      email: user.email,
      enabled: Boolean(presentationAccess),
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PUT(request: Request) {
  const admin = await requireSchoolAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 20_000) return NextResponse.json({ error: "O pedido excede o tamanho permitido." }, { status: 413 });

  try {
    const body = await request.json();
    if (!Array.isArray(body?.coordinatorIds) || body.coordinatorIds.length > 500 || body.coordinatorIds.some((id: unknown) => typeof id !== "string" || !id.trim())) {
      return NextResponse.json({ error: "A lista de coordenadores é inválida." }, { status: 400 });
    }
    const coordinatorIds = [...new Set<string>(body.coordinatorIds.map((id: string) => id.trim()))];
    const validCoordinators = await prisma.schoolMembership.findMany({
      where: { schoolId: admin.schoolContext.schoolId, role: "COORDENADOR", userId: { in: coordinatorIds } },
      select: { userId: true },
    });
    if (validCoordinators.length !== coordinatorIds.length) return NextResponse.json({ error: "Um ou mais utilizadores não são coordenadores desta escola." }, { status: 400 });

    await prisma.$transaction(async (transaction) => {
      await transaction.presentationAccess.deleteMany({ where: { schoolId: admin.schoolContext.schoolId } });
      if (coordinatorIds.length) {
        await transaction.presentationAccess.createMany({
          data: coordinatorIds.map((userId) => ({ schoolId: admin.schoolContext.schoolId, userId })),
        });
      }
    });

    await createActivityLog({
      actorId: admin.session.user.id,
      actorName: describeActorName(admin.session.user),
      action: "Atualizou os acessos às apresentações",
      entity: "PresentationAccess",
      entityId: admin.schoolContext.schoolId,
      details: { enabledCoordinatorIds: coordinatorIds, enabledCount: coordinatorIds.length },
    });

    return NextResponse.json({ success: true, enabledCount: coordinatorIds.length });
  } catch (error) {
    console.error("Presentation access update failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Não foi possível guardar os acessos às apresentações." }, { status: 500 });
  }
}
