import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();
const maxBytes = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function getAdminSchool() {
  const session = await auth();
  if (!session?.user?.id) return { error: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return { error: Response.json({ error: "Apenas administradores podem alterar o logótipo da escola ativa." }, { status: 403 }) };
  }
  return { schoolContext };
}

export async function POST(request: Request) {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "O armazenamento de imagens não está configurado." }, { status: 503 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file !== "object" || typeof (file as File).arrayBuffer !== "function") {
      return Response.json({ error: "Selecione um ficheiro de imagem." }, { status: 400 });
    }
    const image = file as File;
    if (!allowedTypes.has(image.type)) return Response.json({ error: "Formato não suportado. Use PNG, JPG ou WEBP." }, { status: 400 });
    if (!image.size || image.size > maxBytes) return Response.json({ error: "O logótipo deve ter até 5 MB." }, { status: 400 });

    const optimized = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 25_000_000 })
      .rotate()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    const blob = await put(`schools/${admin.schoolContext.schoolId}/branding/logo-${crypto.randomUUID()}.png`, optimized, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/png",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const school = await prisma.school.update({
      where: { id: admin.schoolContext.schoolId },
      data: { logoUrl: blob.url },
      select: { id: true, name: true, logoUrl: true, address: true, website: true, reportEmailTemplate: true },
    });
    return Response.json({ school }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("School logo upload error:", error);
    return Response.json({ error: "Não foi possível carregar o logótipo." }, { status: 500 });
  }
}

export async function DELETE() {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;
  try {
    const school = await prisma.school.update({
      where: { id: admin.schoolContext.schoolId },
      data: { logoUrl: null },
      select: { id: true, name: true, logoUrl: true, address: true, website: true, reportEmailTemplate: true },
    });
    return Response.json({ school });
  } catch (error) {
    console.error("School logo removal error:", error);
    return Response.json({ error: "Não foi possível remover o logótipo." }, { status: 500 });
  }
}
