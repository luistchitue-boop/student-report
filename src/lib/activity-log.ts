import { Prisma, PrismaClient } from "@prisma/client";

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
  await prisma.activityLog.create({
    data: {
      actorId,
      actorName,
      action,
      entity,
      entityId: entityId ?? null,
      details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
