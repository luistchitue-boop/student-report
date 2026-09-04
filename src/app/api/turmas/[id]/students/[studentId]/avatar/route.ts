import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumSize = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; studentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem alterar avatares." }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "O armazenamento de imagens não está configurado." }, { status: 500 });

  try {
    const { id: turmaId, studentId } = await params;
    const student = await prisma.student.findFirst({ where: { id: studentId, turmaId }, select: { id: true } });
    if (!student) return Response.json({ error: "Aluno não encontrado." }, { status: 404 });

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!fileValue || typeof fileValue !== "object" || typeof (fileValue as File).arrayBuffer !== "function") {
      return Response.json({ error: "Selecione uma imagem." }, { status: 400 });
    }

    const file = fileValue as File;
    if (!allowedContentTypes.includes(file.type)) return Response.json({ error: "Formato não suportado. Use JPG, PNG ou WEBP." }, { status: 400 });
    if (file.size > maximumSize) return Response.json({ error: "A imagem não pode exceder 5 MB." }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const blob = await put(`students/${studentId}/avatar-${crypto.randomUUID()}-${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    await prisma.student.update({ where: { id: studentId }, data: { avatarUrl: blob.url } });
    return Response.json({ avatarUrl: blob.url });
  } catch (error) {
    console.error("Student avatar upload error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível guardar o avatar." }, { status: 500 });
  }
}
