import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { auth } from "@/auth";

declare global {
  var schoolContextPrisma: PrismaClient | undefined;
}

const prisma = globalThis.schoolContextPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.schoolContextPrisma = prisma;
}

export const ACTIVE_SCHOOL_COOKIE = "active-school-id";

export async function getSchoolContext(userId?: string) {
  const effectiveUserId = userId ?? (await auth())?.user?.id;
  if (!effectiveUserId) return null;

  const cookieStore = await cookies();
  const requestedSchoolId = cookieStore.get(ACTIVE_SCHOOL_COOKIE)?.value;
  const memberships = await prisma.schoolMembership.findMany({
    where: { userId: effectiveUserId },
    include: {
      school: {
        select: { id: true, name: true, logoUrl: true, address: true, website: true },
      },
    },
    orderBy: [{ createdAt: "asc" }, { schoolId: "asc" }],
  });

  const membership = requestedSchoolId
    ? memberships.find((item) => item.schoolId === requestedSchoolId)
    : memberships.length === 1
      ? memberships[0]
      : null;

  if (!membership) return null;

  return {
    userId: effectiveUserId,
    schoolId: membership.schoolId,
    role: membership.role,
    school: membership.school,
  };
}

export async function getSchoolMemberships(userId: string) {
  return prisma.schoolMembership.findMany({
    where: { userId },
    select: {
      schoolId: true,
      role: true,
      school: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { schoolId: "asc" }],
  });
}
