import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export function buildStudentSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapTurmaForCoordinator(turma: any) {
  return {
    id: turma.id,
    name: turma.name,
    schedule: turma.schedule ?? "Sem horário definido",
    students: turma._count.students,
    subjects: turma.subjects.map((subject: { name: string }) => subject.name),
    roster: turma.students.map((student: any) => ({
      id: student.id,
      name: student.name,
      age: student.age ?? 0,
      attendance: student.attendance ?? "P",
      active: student.active,
      parents: student.parents,
    })),
  };
}

export async function getCoordinatorTurmas(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { role: true },
  });

  if (teacher?.role === "ADMIN") {
    const turmas = await prisma.turma.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: true } },
        subjects: { orderBy: { name: "asc" }, select: { name: true } },
        students: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            age: true,
            attendance: true,
            active: true,
            parents: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
    });

    return turmas.map(mapTurmaForCoordinator);
  }

  const coordinator = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      turmas: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { students: true } },
          subjects: { orderBy: { name: "asc" }, select: { name: true } },
          students: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              age: true,
              attendance: true,
              active: true,
              parents: {
                orderBy: { name: "asc" },
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  return coordinator?.turmas.map(mapTurmaForCoordinator) ?? [];
}

export async function getCoordinatorTurmaById(userId: string, turmaId: string) {
  const turmas = await getCoordinatorTurmas(userId);
  return turmas.find((turma) => turma.id === turmaId) ?? null;
}

export async function getCoordinatorStudentBySlug(userId: string, turmaId: string, studentSlug: string) {
  const turma = await getCoordinatorTurmaById(userId, turmaId);

  if (!turma) {
    return null;
  }

  return (
    turma.roster.find((student: { id: string; name: string }) => student.id === studentSlug) ??
    turma.roster.find((student: { id: string; name: string }) => buildStudentSlug(student.name) === studentSlug) ??
    null
  );
}
