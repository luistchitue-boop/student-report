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

export async function getCoordinatorTurmas(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      turmas: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { students: true },
          },
          students: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              age: true,
              attendance: true,
            },
          },
        },
      },
    },
  });

  return (
    teacher?.turmas.map((turma) => ({
      id: turma.id,
      name: turma.name,
      schedule: turma.schedule ?? "Sem horário definido",
      students: turma._count.students,
      roster: turma.students.map((student) => ({
        id: student.id,
        name: student.name,
        age: student.age ?? 0,
        attendance: student.attendance ?? "P",
      })),
    })) ?? []
  );
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
    turma.roster.find((student) => student.id === studentSlug) ??
    turma.roster.find((student) => buildStudentSlug(student.name) === studentSlug) ??
    null
  );
}
