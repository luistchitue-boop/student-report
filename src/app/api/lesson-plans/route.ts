import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";
import { getCoordinatorPresentationTurmas, hasCoordinatorPresentationAccess } from "@/lib/teacher-data";

export const runtime = "nodejs";

declare global { var lessonPlansPrisma: PrismaClient | undefined; }
const prisma = globalThis.lessonPlansPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.lessonPlansPrisma = prisma;

async function getAccess() {
  const session = await auth();
  if (!session?.user?.id) return { error: Response.json({ error: "Inicie sessão para gerir planos de aula." }, { status: 401 }) };
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "COORDENADOR" || !await hasCoordinatorPresentationAccess(session.user.id, schoolContext.schoolId)) {
    return { error: Response.json({ error: "Não tem acesso aos planos de aula desta escola." }, { status: 403 }) };
  }
  return { userId: session.user.id, schoolId: schoolContext.schoolId };
}

function parseUrls(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Pode adicionar até 20 endereços Web.");
  return [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error("Um dos endereços Web é inválido.");
    const parsed = new URL(item.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Os recursos devem usar endereços HTTP ou HTTPS.");
    if (item.length > 2048) throw new Error("Um dos endereços Web é demasiado longo.");
    return parsed.toString();
  }))];
}

function parseResourceIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 30 || value.some((id) => typeof id !== "string")) throw new Error("A seleção de ficheiros é inválida.");
  return [...new Set(value as string[])];
}

async function validateTurma(userId: string, turmaId: string | null) {
  if (!turmaId) return;
  const turmas = await getCoordinatorPresentationTurmas(userId);
  if (!turmas.some((turma) => turma.id === turmaId)) throw new Error("Não tem acesso à turma escolhida.");
}

async function validateResources(userId: string, schoolId: string, resourceIds: string[]) {
  if (!resourceIds.length) return;
  const count = await prisma.presentationResource.count({ where: { id: { in: resourceIds }, schoolId, userId } });
  if (count !== resourceIds.length) throw new Error("Um ou mais ficheiros não pertencem à sua biblioteca nesta escola.");
}

export async function GET() {
  const access = await getAccess();
  if ("error" in access) return access.error;
  const lessonPlans = await prisma.lessonPlan.findMany({
    where: { schoolId: access.schoolId, userId: access.userId },
    orderBy: { updatedAt: "desc" },
    include: { files: { include: { resource: { select: { id: true, name: true, url: true, contentType: true, size: true } } } } },
  });
  return Response.json({ lessonPlans: lessonPlans.map(({ files, ...lesson }) => ({ ...lesson, files: files.map(({ resource }) => resource) })) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  if (Number(request.headers.get("content-length") ?? 0) > 40_000) return Response.json({ error: "O pedido excede o tamanho permitido." }, { status: 413 });
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
    const lessonNumber = typeof body.lessonNumber === "string" ? body.lessonNumber.trim().slice(0, 80) || null : null;
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : "";
    const level = typeof body.level === "string" ? body.level.trim().slice(0, 120) : "";
    const objectives = typeof body.objectives === "string" ? body.objectives.trim().slice(0, 8000) : "";
    const lessonDetails = typeof body.lessonDetails === "string" ? body.lessonDetails.trim().slice(0, 12000) : "";
    const turmaId = typeof body.turmaId === "string" && body.turmaId ? body.turmaId : null;
    const resourceUrls = parseUrls(body.resourceUrls);
    const resourceIds = parseResourceIds(body.resourceIds);
    const id = typeof body.id === "string" ? body.id : "";
    if (!title || !subject || !level) return Response.json({ error: "O título, a disciplina e o nível são obrigatórios." }, { status: 400 });
    await validateTurma(access.userId, turmaId);
    await validateResources(access.userId, access.schoolId, resourceIds);

    const data = { title, lessonNumber, subject, level, objectives, lessonDetails, turmaId, resourceUrls };
    const lesson = id
      ? await prisma.$transaction(async (transaction) => {
          const owned = await transaction.lessonPlan.findFirst({ where: { id, schoolId: access.schoolId, userId: access.userId }, select: { id: true } });
          if (!owned) throw new Error("Plano de aula não encontrado.");
          await transaction.lessonPlan.update({ where: { id }, data });
          await transaction.lessonPlanFile.deleteMany({ where: { lessonPlanId: id } });
          if (resourceIds.length) await transaction.lessonPlanFile.createMany({ data: resourceIds.map((resourceId) => ({ lessonPlanId: id, resourceId })) });
          return transaction.lessonPlan.findUniqueOrThrow({ where: { id }, include: { files: { include: { resource: { select: { id: true, name: true, url: true, contentType: true, size: true } } } } } });
        })
      : await prisma.lessonPlan.create({ data: { ...data, schoolId: access.schoolId, userId: access.userId, files: { create: resourceIds.map((resourceId) => ({ resourceId })) } }, include: { files: { include: { resource: { select: { id: true, name: true, url: true, contentType: true, size: true } } } } } });

    const { files, ...lessonPlan } = lesson;
    return Response.json({ lessonPlan: { ...lessonPlan, files: files.map(({ resource }) => resource) } }, { status: id ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível guardar o plano de aula." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const result = await prisma.lessonPlan.deleteMany({ where: { id, schoolId: access.schoolId, userId: access.userId } });
    if (!result.count) return Response.json({ error: "Plano de aula não encontrado." }, { status: 404 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Não foi possível eliminar o plano de aula." }, { status: 400 });
  }
}
