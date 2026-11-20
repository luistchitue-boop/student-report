import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

export const runtime = "nodejs";

declare global { var studentSearchPrisma: PrismaClient | undefined; }
const prisma = globalThis.studentSearchPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.studentSearchPrisma = prisma;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Inicie sessão para pesquisar alunos." }, { status: 401 });
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext) return Response.json({ error: "Selecione uma escola ativa." }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 2) return Response.json({ students: [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });

  const classScope = schoolContext.role === "ADMIN"
    ? { schoolId: schoolContext.schoolId }
    : schoolContext.role === "DIRECCAO"
      ? {
          schoolId: schoolContext.schoolId,
          OR: [
            { teacherAssignments: { some: { teacher: { userId: session.user.id } } } },
            { direccaoAssignments: { some: { teacher: { userId: session.user.id } } } },
          ],
        }
      : schoolContext.role === "COORDENADOR"
        ? { schoolId: schoolContext.schoolId, teacherAssignments: { some: { teacher: { userId: session.user.id } } } }
        : null;

  if (!classScope) return Response.json({ error: "Não tem permissão para pesquisar alunos." }, { status: 403 });

  const students = await prisma.student.findMany({
    where: {
      turma: classScope,
      name: { contains: query, mode: "insensitive" },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      turma: { select: { id: true, name: true } },
    },
  });

  return Response.json({ students }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
