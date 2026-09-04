import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET(_request: Request, { params }: { params: Promise<{ absenceId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { absenceId } = await params;
  const isAdmin = session.user.role === "ADMIN";
  const absence = await prisma.absence.findFirst({
    where: isAdmin
      ? { id: absenceId }
      : { id: absenceId, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
    select: { attachmentUrl: true, attachmentName: true, attachmentContentType: true },
  });

  if (!absence) return NextResponse.json({ error: "Justificativo não encontrado." }, { status: 404 });
  if (!absence.attachmentUrl) return NextResponse.json({ error: "Este justificativo não tem comprovativo." }, { status: 404 });

  const blobResponse = await fetch(absence.attachmentUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ""}` },
  });
  if (!blobResponse.ok || !blobResponse.body) {
    return NextResponse.json({ error: "Não foi possível obter o comprovativo." }, { status: 502 });
  }

  return new NextResponse(blobResponse.body, {
    headers: {
      "Content-Type": absence.attachmentContentType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${(absence.attachmentName ?? "comprovativo").replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
