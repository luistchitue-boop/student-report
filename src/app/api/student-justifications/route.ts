import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const absenceIds: string[] = Array.isArray(body.absenceIds)
      ? body.absenceIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!absenceIds.length || !title || !notes) return NextResponse.json({ error: "Selecione faltas e preencha os dois campos." }, { status: 400 });

    const uniqueAbsenceIds = [...new Set(absenceIds)];
    const absences = await prisma.absence.findMany({
      where: { id: { in: uniqueAbsenceIds }, student: { turma: { coordinator: { userId: session.user.id } } } },
      select: { id: true },
    });

    if (absences.length !== uniqueAbsenceIds.length) return NextResponse.json({ error: "Uma ou mais faltas não foram encontradas." }, { status: 404 });

    const justifiedAbsences = await prisma.$transaction(
      absences.map((absence) => prisma.absence.update({
        where: { id: absence.id },
        data: { justified: true, justificationTitle: title, justificationNotes: notes },
        select: { id: true, justified: true, justificationTitle: true, justificationNotes: true },
      })),
    );

    return NextResponse.json({
      success: true,
      justified: justifiedAbsences.length,
      absenceIds: justifiedAbsences.filter((absence) => absence.justified).map((absence) => absence.id),
      title,
      notes,
    });
  } catch (error) {
    console.error("Justification save error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save justification" }, { status: 500 });
  }
}
