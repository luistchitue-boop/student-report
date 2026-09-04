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
      avatarUrl: student.avatarUrl,
      parents: student.parents,
    })),
  };
}

const turmaInclude = {
  _count: { select: { students: true } },
  subjects: { orderBy: { name: "asc" as const }, select: { name: true } },
  students: {
    orderBy: { name: "asc" as const },
    select: {
      id: true, name: true, age: true, attendance: true, active: true, avatarUrl: true,
      parents: { orderBy: { name: "asc" as const }, select: { id: true, name: true, phone: true, email: true } },
    },
  },
};

export async function getCoordinatorTurmas(userId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { role: true } });
  if (teacher?.role === "ADMIN") {
    return (await prisma.turma.findMany({ orderBy: { name: "asc" }, include: turmaInclude })).map(mapTurmaForCoordinator);
  }

  const coordinator = await prisma.teacher.findUnique({
    where: { userId },
    include: { turmaAssignments: { include: { turma: { include: turmaInclude } } } },
  });
  if (!coordinator) return [];
  const assignedTurmas = coordinator.turmaAssignments.map((assignment) => assignment.turma);
  return assignedTurmas.map(mapTurmaForCoordinator);
}

export async function getCoordinatorTurmaById(userId: string, turmaId: string) {
  const turmas = await getCoordinatorTurmas(userId);
  return turmas.find((turma) => turma.id === turmaId) ?? null;
}

export async function getCoordinatorStudentBySlug(userId: string, turmaId: string, studentSlug: string) {
  const turma = await getCoordinatorTurmaById(userId, turmaId);
  if (!turma) return null;
  return turma.roster.find((student: { id: string; name: string }) => student.id === studentSlug) ?? turma.roster.find((student: { id: string; name: string }) => buildStudentSlug(student.name) === studentSlug) ?? null;
}
