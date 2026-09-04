import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "COORDENADOR") return NextResponse.json({ error: "Sem permissão para justificar faltas." }, { status: 403 });

  try {
    const body = await request.json();
    const absenceIds: string[] = Array.isArray(body.absenceIds)
      ? body.absenceIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const attachment = body.attachment && typeof body.attachment === "object" ? body.attachment as {
      url?: unknown;
      pathname?: unknown;
      name?: unknown;
      contentType?: unknown;
      size?: unknown;
    } : null;

    if (!absenceIds.length || !title || !notes) return NextResponse.json({ error: "Selecione faltas e preencha os dois campos." }, { status: 400 });
    let attachmentUrl = "";
    if (attachment) {
      try {
        const parsedUrl = new URL(typeof attachment.url === "string" ? attachment.url : "");
        attachmentUrl = parsedUrl.toString();
        if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".blob.vercel-storage.com") || typeof attachment.pathname !== "string" || !attachment.pathname.startsWith("justifications/")) throw new Error();
      } catch {
        return NextResponse.json({ error: "Comprovativo inválido." }, { status: 400 });
      }
    }
    if (attachment && !attachmentUrl) {
      return NextResponse.json({ error: "Comprovativo inválido." }, { status: 400 });
    }

    const uniqueAbsenceIds = [...new Set(absenceIds)];
    const isAdmin = (session.user.role ?? "COORDENADOR") === "ADMIN";
    const absences = await prisma.absence.findMany({
      where: isAdmin
        ? { id: { in: uniqueAbsenceIds } }
        : { id: { in: uniqueAbsenceIds }, student: { turma: { teacherAssignments: { some: { teacher: { userId: session.user.id } } } } } },
      select: { id: true },
    });

    if (absences.length !== uniqueAbsenceIds.length) return NextResponse.json({ error: "Uma ou mais faltas não foram encontradas." }, { status: 404 });

    const justifiedAbsences = await prisma.$transaction(
      absences.map((absence) => prisma.absence.update({
        where: { id: absence.id },
        data: {
          justified: true,
          justificationTitle: title,
          justificationNotes: notes,
          ...(attachment ? {
            attachmentUrl,
            attachmentPathname: attachment.pathname as string,
            attachmentName: typeof attachment.name === "string" ? attachment.name : "comprovativo",
            attachmentContentType: typeof attachment.contentType === "string" ? attachment.contentType : null,
            attachmentSize: typeof attachment.size === "number" ? attachment.size : null,
          } : {}),
        },
        select: { id: true, justified: true, justificationTitle: true, justificationNotes: true, attachmentUrl: true, attachmentName: true },
      })),
    );

    await createActivityLog({
      actorId: session.user.id,
      actorName: describeActorName(session.user),
      action: "Justificou faltas",
      entity: "Absence",
      entityId: null,
      details: {
        absenceIds: justifiedAbsences.map((absence) => absence.id),
        title,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      justified: justifiedAbsences.length,
      absenceIds: justifiedAbsences.filter((absence) => absence.justified).map((absence) => absence.id),
      title,
      notes,
      attachment: justifiedAbsences[0]?.attachmentUrl ? { url: justifiedAbsences[0].attachmentUrl, name: justifiedAbsences[0].attachmentName } : null,
    });
  } catch (error) {
    console.error("Justification save error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível guardar a justificação" }, { status: 500 });
  }
}
