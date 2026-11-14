import { Prisma, PrismaClient } from "@prisma/client";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

export async function createActivityLog({
  actorId,
  actorName,
  action,
  entity,
  entityId,
  details,
}: {
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  const schoolContext = await getSchoolContext(actorId);
  if (!schoolContext) throw new Error("Não existe uma escola ativa autorizada para este utilizador.");

  await prisma.activityLog.create({
    data: {
      schoolId: schoolContext.schoolId,
      actorId,
      actorName,
      action,
      entity,
      entityId: entityId ?? null,
      details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

export function describeActorName(sessionUser: { name?: string | null; email?: string | null }) {
  return sessionUser.name ?? sessionUser.email ?? "Utilizador";
}
