import { handleUpload } from "@vercel/blob/client";
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
    const body = await request.json();
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("justifications/") || pathname.includes("..")) {
          throw new Error("Caminho de anexo inválido.");
        }

        const payload = clientPayload ? JSON.parse(clientPayload) as { absenceIds?: unknown } : {};
        const absenceIds = Array.isArray(payload.absenceIds)
          ? payload.absenceIds.filter((id): id is string => typeof id === "string")
          : [];
        if (!absenceIds.length) throw new Error("Selecione pelo menos uma falta.");

        const isAdmin = session.user.role === "ADMIN";
        const accessibleCount = await prisma.absence.count({
          where: isAdmin
            ? { id: { in: absenceIds } }
            : { id: { in: absenceIds }, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
        });
        if (accessibleCount !== new Set(absenceIds).size) throw new Error("Uma ou mais faltas não foram encontradas.");

        return {
          allowedContentTypes,
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Justification attachment upload error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível preparar o upload." }, { status: 400 });
  }
}
