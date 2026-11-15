import { Prisma, PrismaClient } from "@prisma/client";
import { getRootAdmin } from "@/lib/root-admin";

const prisma = new PrismaClient();

export async function GET() {
  const root = await getRootAdmin();
  if (!root) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, isActive: true, reportsEnabled: true,
      memberships: {
        where: { role: "ADMIN" },
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return Response.json({ schools }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PATCH(request: Request) {
  const root = await getRootAdmin();
  if (!root) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const body = await request.json();
    const schoolId = typeof body.schoolId === "string" ? body.schoolId : "";
    if (!schoolId) return Response.json({ error: "Selecione uma escola." }, { status: 400 });
    if (body.action !== "setStatus" && body.action !== "grantAdmin" && body.action !== "revokeAdmin") {
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, isActive: true, reportsEnabled: true } });
      if (!school) return { error: "Escola não encontrada.", status: 404 } as const;

      if (body.action === "setStatus") {
        if (typeof body.isActive !== "boolean" || typeof body.reportsEnabled !== "boolean") return { error: "Estado inválido.", status: 400 } as const;
        await tx.school.update({ where: { id: schoolId }, data: { isActive: body.isActive, reportsEnabled: body.reportsEnabled } });
        await tx.rootActivityLog.create({ data: { actorId: root.id, schoolId, action: "school.status", details: { before: { isActive: school.isActive, reportsEnabled: school.reportsEnabled }, after: { isActive: body.isActive, reportsEnabled: body.reportsEnabled } } } });
        return { success: true } as const;
      }

      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email) return { error: "Indique o e-mail da conta existente.", status: 400 } as const;
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true } });
      if (!user) return { error: "A conta não existe. O utilizador deve ter uma conta antes de ser adicionado.", status: 404 } as const;
      const membership = await tx.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId: user.id } } });
      if (body.action === "grantAdmin") {
        if (membership?.role === "ADMIN") return { error: "A conta já é administradora desta escola.", status: 409 } as const;
        await tx.schoolMembership.upsert({ where: { schoolId_userId: { schoolId, userId: user.id } }, create: { schoolId, userId: user.id, role: "ADMIN" }, update: { role: "ADMIN" } });
      } else {
        if (!membership || membership.role !== "ADMIN") return { error: "A conta não é administradora desta escola.", status: 404 } as const;
        const count = await tx.schoolMembership.count({ where: { schoolId, role: "ADMIN" } });
        if (count <= 1) return { error: "A escola deve manter pelo menos um administrador.", status: 409 } as const;
        await tx.schoolMembership.update({ where: { schoolId_userId: { schoolId, userId: user.id } }, data: { role: "COORDENADOR" } });
      }
      await tx.rootActivityLog.create({ data: { actorId: root.id, schoolId, action: body.action === "grantAdmin" ? "admin.grant" : "admin.revoke", details: { targetUserId: user.id, email: user.email, previousRole: membership?.role ?? null, role: body.action === "grantAdmin" ? "ADMIN" : "COORDENADOR" } } });
      return { success: true } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    console.error("Root school management error:", error);
    return Response.json({ error: "Não foi possível atualizar a escola. Tente novamente." }, { status: 500 });
  }
}
