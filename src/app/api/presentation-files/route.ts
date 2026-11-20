import { del, put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";
import { hasCoordinatorPresentationAccess } from "@/lib/teacher-data";

export const runtime = "nodejs";

declare global { var presentationFilesPrisma: PrismaClient | undefined; }
const prisma = globalThis.presentationFilesPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.presentationFilesPrisma = prisma;

const allowedTypes = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function getAccess() {
  const session = await auth();
  if (!session?.user?.id) return { error: Response.json({ error: "Inicie sessão para gerir ficheiros." }, { status: 401 }) };
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "COORDENADOR" || !await hasCoordinatorPresentationAccess(session.user.id, schoolContext.schoolId)) return { error: Response.json({ error: "Não tem acesso aos ficheiros de apresentações." }, { status: 403 }) };
  return { userId: session.user.id, schoolId: schoolContext.schoolId, token: process.env.BLOB_READ_WRITE_TOKEN };
}

export async function GET() {
  const access = await getAccess();
  if ("error" in access) return access.error;
  const files = await prisma.presentationResource.findMany({ where: { schoolId: access.schoolId, userId: access.userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, url: true, contentType: true, size: true, createdAt: true } });
  return Response.json({ files }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  if (!access.token) return Response.json({ error: "O armazenamento de ficheiros não está configurado." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 21_000_000) return Response.json({ error: "O pedido excede o limite de 20 MB." }, { status: 413 });
  let uploadedUrl = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file !== "object" || typeof (file as File).arrayBuffer !== "function") return Response.json({ error: "Escolha um ficheiro para carregar." }, { status: 400 });
    const uploadedFile = file as File;
    if (!allowedTypes.has(uploadedFile.type)) return Response.json({ error: "Formato não suportado. Use PDF, imagem, texto ou documento Office." }, { status: 400 });
    if (uploadedFile.size < 1 || uploadedFile.size > 20 * 1024 * 1024) return Response.json({ error: "O ficheiro deve ter entre 1 byte e 20 MB." }, { status: 400 });
    const count = await prisma.presentationResource.count({ where: { schoolId: access.schoolId, userId: access.userId } });
    if (count >= 100) return Response.json({ error: "A biblioteca atingiu o limite de 100 ficheiros." }, { status: 400 });

    const name = uploadedFile.name.replace(/[\\/\u0000-\u001f]/g, "-").trim().slice(0, 180) || "ficheiro";
    const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const blob = await put(`schools/${access.schoolId}/presentation-resources/${access.userId}/${crypto.randomUUID()}-${safeName}`, uploadedFile, {
      access: "public",
      addRandomSuffix: true,
      contentType: uploadedFile.type,
      token: access.token,
    });
    uploadedUrl = blob.url;
    const saved = await prisma.presentationResource.create({ data: { schoolId: access.schoolId, userId: access.userId, name, url: blob.url, pathname: blob.pathname, contentType: uploadedFile.type, size: uploadedFile.size } });
    return Response.json({ file: { id: saved.id, name: saved.name, url: saved.url, contentType: saved.contentType, size: saved.size, createdAt: saved.createdAt } }, { status: 201 });
  } catch (error) {
    if (uploadedUrl) await del(uploadedUrl, { token: access.token }).catch(() => undefined);
    console.error("Presentation resource upload failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Não foi possível carregar o ficheiro." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await getAccess();
  if ("error" in access) return access.error;
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const file = await prisma.presentationResource.findFirst({ where: { id, schoolId: access.schoolId, userId: access.userId } });
    if (!file) return Response.json({ error: "Ficheiro não encontrado." }, { status: 404 });
    await del(file.url, { token: access.token });
    await prisma.presentationResource.delete({ where: { id: file.id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Presentation resource deletion failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Não foi possível eliminar o ficheiro." }, { status: 500 });
  }
}
