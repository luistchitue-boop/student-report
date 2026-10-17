import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

declare global {
  var prismaAdminInternshipReports: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminInternshipReports ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaAdminInternshipReports = prisma;

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const students = await prisma.student.findMany({
      where: { turma: { isInternship: true } },
      orderBy: [{ turma: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        turma: { select: { id: true, name: true } },
        parents: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, phone: true } },
        internshipPerformanceReports: {
          orderBy: { periodStart: "desc" },
          include: {
            teacher: { select: { name: true } },
            deliveries: {
              orderBy: { attemptedAt: "desc" },
              select: { id: true, recipientName: true, recipientContact: true, channel: true, status: true, error: true, attemptedAt: true },
            },
          },
        },
      },
    });
    return NextResponse.json({ students });
  } catch (error) {
    console.error("Admin internship reports load error:", error);
    return NextResponse.json({ error: "Não foi possível carregar os relatórios de estágio." }, { status: 500 });
  }
}
