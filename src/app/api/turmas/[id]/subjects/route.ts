import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();

function normalizeSubjectName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) return NextResponse.json({ error: "Selecione uma escola autorizada." }, { status: 403 });

  const { id } = await params;
  const isAdmin = schoolContext.role === "ADMIN";

  const turma = await prisma.turma.findFirst({
    where: isAdmin
      ? { id, schoolId: schoolContext.schoolId }
      : { id, schoolId: schoolContext.schoolId, teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
    select: { subjects: { orderBy: { name: "asc" }, select: { name: true } } },
  });

  if (!turma) {
    return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  }

  return NextResponse.json({ subjects: turma.subjects.map((subject) => subject.name) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const name = normalizeSubjectName(body.name);

  if (!name) {
    return NextResponse.json({ error: "O nome da disciplina é obrigatório." }, { status: 400 });
  }

  const turma = await prisma.turma.findFirst({ where: { id, schoolId: schoolContext.schoolId }, select: { id: true } });

  if (!turma) {
    return NextResponse.json({ error: "Turma not found" }, { status: 404 });
  }

  const existing = await prisma.subject.findUnique({
    where: { turmaId_name: { turmaId: id, name } },
  });

  if (existing) {
    return NextResponse.json({ error: "Essa disciplina já existe nesta turma." }, { status: 409 });
  }

  const subject = await prisma.subject.create({
    data: { turmaId: id, name },
  });

  return NextResponse.json({ success: true, subject }, { status: 201 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const oldName = normalizeSubjectName(body.oldName);
  const newName = normalizeSubjectName(body.newName);
  const turma = await prisma.turma.findFirst({ where: { id, schoolId: schoolContext.schoolId }, select: { id: true } });
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });


  if (!oldName || !newName) {
    return NextResponse.json({ error: "Nome da disciplina inválido." }, { status: 400 });
  }

  const existing = await prisma.subject.findUnique({
    where: { turmaId_name: { turmaId: id, name: newName } },
  });

  if (existing && existing.name !== oldName) {
    return NextResponse.json({ error: "Essa disciplina já existe nesta turma." }, { status: 409 });
  }

  const subject = await prisma.subject.update({
    where: { turmaId_name: { turmaId: id, name: oldName } },
    data: { name: newName },
  });

  return NextResponse.json({ success: true, subject });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const name = normalizeSubjectName(body.name);
  const turma = await prisma.turma.findFirst({ where: { id, schoolId: schoolContext.schoolId }, select: { id: true } });
  if (!turma) return NextResponse.json({ error: "Turma not found" }, { status: 404 });


  if (!name) {
    return NextResponse.json({ error: "O nome da disciplina é obrigatório." }, { status: 400 });
  }

  const subject = await prisma.subject.delete({
    where: { turmaId_name: { turmaId: id, name } },
  });

  return NextResponse.json({ success: true, subject });
}
