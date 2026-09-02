import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

declare global {
  var prismaAdminTeachers: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminTeachers ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAdminTeachers = prisma;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  const [teachers, turmas] = await Promise.all([
    prisma.teacher.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, user: { select: { email: true } }, turmas: { select: { id: true } } },
    }),
    prisma.turma.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, coordinatorId: true } }),
  ]);

  return NextResponse.json({ teachers, turmas });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  try {
    const body = await request.json();
    const teacherId = typeof body.teacherId === "string" ? body.teacherId : "";
    const requestedRole = body.role === "ADMIN" || body.role === "DIRECCAO" || body.role === "COORDENADOR" ? body.role : "";
    const requestedTurmaIds: unknown[] = Array.isArray(body.turmaIds) ? body.turmaIds : [];
    const turmaIds = [...new Set(requestedTurmaIds.filter((id): id is string => typeof id === "string"))];
    const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, role: { not: "ADMIN" } }, include: { turmas: { select: { id: true } } } });
    if (!teacher) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    if (!requestedRole) return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });

    const validTurmas = await prisma.turma.findMany({ where: { id: { in: turmaIds } }, select: { id: true } });
    if (validTurmas.length !== turmaIds.length) return NextResponse.json({ error: "Uma ou mais turmas não foram encontradas" }, { status: 400 });

    await prisma.$transaction([
      prisma.teacher.update({ where: { id: teacher.id }, data: { role: requestedRole } }),
      prisma.turma.updateMany({ where: { coordinatorId: teacher.id }, data: { coordinatorId: null } }),
      ...(turmaIds.length ? [prisma.turma.updateMany({ where: { id: { in: turmaIds } }, data: { coordinatorId: teacher.id } })] : []),
    ]);

    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Atualizou o perfil e as atribuições",
      entity: "Teacher",
      entityId: teacher.id,
      details: { role: requestedRole, previousRole: teacher.role, turmaIds, previousTurmaIds: teacher.turmas.map((turma) => turma.id) },
    });

    return NextResponse.json({ success: true, role: requestedRole, turmaIds });
  } catch (error) {
    console.error("Admin teacher assignment error:", error);
    return NextResponse.json({ error: "Não foi possível atualizar as atribuições" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const turmaNames = Array.isArray(body.turmaNames) ? body.turmaNames : [];
    const requestedRole = body.role === "DIRECCAO" ? "DIRECCAO" : "COORDENADOR";

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nome, email e senha são obrigatórios" }, { status: 400 });
    }

    if (turmaNames.length === 0) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: await bcrypt.hash(password, 10),
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          password: await bcrypt.hash(password, 10),
        },
      });
    }

    let teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          name,
          role: requestedRole,
        },
      });
    } else {
      teacher = await prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          name,
          role: requestedRole,
        },
      });
    }

    for (const turmaName of turmaNames) {
      if (!turmaName) continue;

      await prisma.turma.updateMany({
        where: { name: turmaName },
        data: { coordinatorId: teacher.id },
      });
    }

    return NextResponse.json({
      message: "Professor criado com sucesso",
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: user.email,
        role: teacher.role,
      },
      turmas: turmaNames,
    });
  } catch (error) {
    console.error("Admin teacher creation error:", error);
    return NextResponse.json({ error: "Não foi possível criar o professor" }, { status: 500 });
  }
}
