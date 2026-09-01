import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import { auth } from "@/auth";

declare global {
  var prismaAdminReports: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminReports ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaAdminReports = prisma;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "relatorio";
}

function generateStudentReportPdf({
  studentName,
  turmaName,
  grades,
  absences,
}: {
  studentName: string;
  turmaName: string;
  grades: Array<{ subject: string; value: number; term: string }>;
  absences: Array<{ subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }>;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(27, 57, 52);
  doc.rect(0, 0, pageWidth, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("NEPH Relatórios", 40, 42);
  doc.setFontSize(11);
  doc.text("Relatório escolar", 40, 58);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(`Aluno: ${studentName}`, 40, 110);
  doc.text(`Turma: ${turmaName}`, 40, 132);

  const average = grades.length
    ? (grades.reduce((total, grade) => total + Number(grade.value), 0) / grades.length).toFixed(1)
    : "0.0";
  doc.text(`Média: ${average}`, 40, 154);

  let y = 190;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Notas", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");

  if (grades.length === 0) {
    doc.text("Sem notas registadas.", 40, y);
    y += 18;
  } else {
    grades.forEach((grade) => {
      const line = `${grade.subject} • ${grade.value} • ${grade.term}`;
      doc.text(line, 40, y);
      y += 16;
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 50;
      }
    });
  }

  y += 18;
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 50;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Faltas", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");

  if (absences.length === 0) {
    doc.text("Sem faltas registadas.", 40, y);
  } else {
    absences.forEach((absence) => {
      const dia = absence.dia.toISOString().slice(0, 10);
      const line = `${dia} • ${absence.subject} • ${absence.tempo} • ${absence.faultType} • ${absence.justified ? "Justificada" : "Injustificada"}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - 90);
      wrapped.forEach((part: string) => {
        doc.text(part, 40, y);
        y += 14;
        if (y > pageHeight - 50) {
          doc.addPage();
          y = 50;
        }
      });
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const rawTurmaIds = Array.isArray(body.turmaIds) ? body.turmaIds : [];
    const turmaIds = rawTurmaIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value));

    if (!turmaIds.length) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma" }, { status: 400 });
    }

    const turmas = await prisma.turma.findMany({
      where: { id: { in: turmaIds } },
      include: {
        students: {
          include: {
            parents: { select: { id: true, name: true, email: true } },
            grades: true,
            absences: true,
          },
        },
      },
    });

    const recipients: Array<{ email: string; fileName: string; pdf: Buffer; studentName: string }> = [];

    for (const turma of turmas) {
      for (const student of turma.students) {
        if (!student.parents.length) continue;

        const approvedParentEmails = [...new Set(
          student.parents
            .map((parent: { email?: string | null }) => parent.email?.trim().toLowerCase())
            .filter((email): email is string => typeof email === "string" && email.length > 0 && email.includes("@"))
        )];

        if (!approvedParentEmails.length) continue;

        const pdf = generateStudentReportPdf({
          studentName: student.name,
          turmaName: turma.name,
          grades: student.grades.map((grade: { subject: string; value: number | string; term: string }) => ({
            subject: grade.subject,
            value: Number(grade.value),
            term: grade.term,
          })),
          absences: student.absences.map((absence: { subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }) => ({
            subject: absence.subject,
            dia: absence.dia,
            tempo: absence.tempo,
            faultType: absence.faultType,
            justified: absence.justified,
          })),
        });

        approvedParentEmails.forEach((email: string) => {
          recipients.push({
            email,
            fileName: `${safeFileName(student.name)}-${safeFileName(turma.name)}.pdf`,
            pdf,
            studentName: student.name,
          });
        });
      }
    }

    if (!recipients.length) {
      return NextResponse.json({ success: true, sent: 0, message: "Nenhum encarregado com email encontrado nas turmas selecionadas." });
    }

    const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      return NextResponse.json({ error: "Resend não está configurado. Adicione RESEND_API_KEY e RESEND_FROM_EMAIL." }, { status: 500 });
    }

    const resend = new Resend(RESEND_API_KEY);
    let sent = 0;

    for (const recipient of recipients) {
      const result = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: recipient.email,
        subject: `Relatório escolar - ${recipient.studentName}`,
        text: `Caro encarregado de educação,\n\nSegue em anexo o relatório escolar do aluno ${recipient.studentName}.\n\nAtenciosamente,\nNEPH Relatórios`,
        attachments: [{
          filename: recipient.fileName,
          content: recipient.pdf.toString("base64"),
        }],
      });

      if (!result.error) {
        sent += 1;
      }
    }

    return NextResponse.json({ success: true, sent, total: recipients.length });
  } catch (error) {
    console.error("Admin report dispatch error:", error);
    return NextResponse.json({ error: "Não foi possível enviar os relatórios." }, { status: 500 });
  }
}
