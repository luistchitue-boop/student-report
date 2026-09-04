import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();
const allowedContentTypes = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") {
    return NextResponse.json({ error: "Sem permissão para anexar comprovativos." }, { status: 403 });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "O armazenamento de comprovativos não está configurado." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawAbsenceIds = formData.get("absenceIds");
    let absenceIds: unknown = [];
    try {
      absenceIds = typeof rawAbsenceIds === "string" ? JSON.parse(rawAbsenceIds) as unknown : [];
    } catch {
      return NextResponse.json({ error: "A seleção de faltas é inválida." }, { status: 400 });
    }
    const validAbsenceIds = Array.isArray(absenceIds) ? absenceIds.filter((id): id is string => typeof id === "string") : [];

    if (!file || typeof file !== "object" || typeof (file as File).arrayBuffer !== "function") return NextResponse.json({ error: "Selecione um comprovativo." }, { status: 400 });
    const uploadedFile = file as File;
    if (!allowedContentTypes.includes(uploadedFile.type)) return NextResponse.json({ error: "Formato não suportado. Use PDF, JPG ou PNG." }, { status: 400 });
    if (uploadedFile.size > 10 * 1024 * 1024) return NextResponse.json({ error: "O comprovativo não pode exceder 10 MB." }, { status: 400 });
    if (!validAbsenceIds.length) return NextResponse.json({ error: "Selecione pelo menos uma falta." }, { status: 400 });

    const isAdmin = session.user.role === "ADMIN";
    const accessibleCount = await prisma.absence.count({
      where: isAdmin
        ? { id: { in: validAbsenceIds } }
        : { id: { in: validAbsenceIds }, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
    });
    if (accessibleCount !== new Set(validAbsenceIds).size) throw new Error("Uma ou mais faltas não foram encontradas.");

    const safeName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const result = await put(`justifications/${validAbsenceIds[0]}/${crypto.randomUUID()}-${safeName}`, uploadedFile, {
      access: "private",
      addRandomSuffix: true,
      contentType: uploadedFile.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Justification attachment upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível preparar o upload." }, { status: 500 });
  }
}
