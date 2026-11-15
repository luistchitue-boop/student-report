import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();
const rootEmail = "luis.tchitue@neph.ao";

export function isReservedRootEmail(email: string) {
  return email.trim().toLowerCase() === rootEmail;
}

export async function getRootAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const users = await prisma.user.findMany({
    where: { email: { equals: rootEmail, mode: "insensitive" } },
    select: { id: true, email: true },
    take: 2,
  });
  if (users.length !== 1 || users[0].id !== session.user.id) return null;
  const user = users[0];
  return user;
}
