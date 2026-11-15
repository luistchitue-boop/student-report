import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ schools }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
