import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { put } from "@vercel/blob";
import { jsPDF } from "jspdf";
import { auth } from "@/auth";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function buildReportEmailHtml({ logoUrl, reportUrl, studentName, firstName, periodLabel }: { logoUrl: string; reportUrl: string; studentName: string; firstName: string; periodLabel: string }) {
  const safeStudentName = escapeHtml(studentName);
  const safeFirstName = escapeHtml(firstName);
  const safeReportUrl = escapeHtml(reportUrl);
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório escolar</title></head><body style="margin:0;padding:0;background:#fff9df;font-family:Arial,Helvetica,sans-serif;color:#173044"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff9df;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff"><tr><td style="background:#d9edf3;padding:24px 32px;border-bottom:4px solid #f3c0bd"><img src="${escapeHtml(logoUrl)}" width="56" height="56" alt="Logótipo da Nova Escola Politécnica do Huambo" style="display:block;width:56px;height:56px;object-fit:contain"></td></tr><tr><td style="padding:38px 40px 34px"><div style="font-size:11px;letter-spacing:2px;color:#176b8b;font-weight:bold">RELATÓRIO ESCOLAR</div><h1 style="font-size:26px;line-height:1.25;color:#173044;margin:12px 0 18px">O seu relatório está pronto para leitura</h1><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 18px">Saudações, Sr.(a) ${safeFirstName}.</p><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 24px">O relatório escolar de <strong>${safeStudentName}</strong>, referente ao período ${escapeHtml(periodLabel)}, está disponível através do botão abaixo.</p><p style="margin:0 0 24px"><a href="${safeReportUrl}" style="display:inline-block;background:#176b8b;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:6px">Abrir relatório em PDF</a></p><p style="font-size:12px;line-height:1.6;color:#607583;margin:0">Se o botão não funcionar, abra este endereço: <a href="${safeReportUrl}" style="color:#176b8b">${safeReportUrl}</a></p></td></tr></table></td></tr></table></body></html>`;
}

function getReportEmailOverride(options: { logoUrl: string; reportUrl: string; studentName: string; firstName: string; periodLabel: string }): Record<string, string> {
  return { html: buildReportEmailHtml(options) };
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
    const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
    const period = getWeeklyCoordinationPeriods(new Date().getFullYear()).find((item) => item.key === periodKey);

    if (!period) {
      return NextResponse.json({ error: "Selecione um período semanal válido." }, { status: 400 });
    }

    if (period.key > formatPeriodDate(new Date())) {
      return NextResponse.json({ error: "Não é possível enviar relatórios de um período futuro." }, { status: 400 });
    }

    if (!turmaIds.length) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma" }, { status: 400 });
    }

    const { RESEND_API_KEY, RESEND_FROM_EMAIL, BLOB_READ_WRITE_TOKEN } = process.env;
    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      return NextResponse.json({ error: "Resend não está configurado. Adicione RESEND_API_KEY e RESEND_FROM_EMAIL." }, { status: 500 });
    }
    if (!BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "O armazenamento de relatórios não está configurado. Adicione BLOB_READ_WRITE_TOKEN." }, { status: 500 });
    }

    const turmas = await prisma.turma.findMany({
      where: { id: { in: turmaIds } },
      include: {
        students: {
          include: {
            parents: { select: { id: true, name: true, email: true } },
            grades: { where: { term: `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}` } },
            absences: { where: { dia: { gte: new Date(`${formatPeriodDate(period.start)}T00:00:00Z`), lte: new Date(`${formatPeriodDate(period.end)}T23:59:59.999Z`) } } },
          },
        },
      },
    });

    const recipients: Array<{ email: string; reportUrl: string; studentName: string; firstName: string }> = [];

    for (const turma of turmas) {
      for (const student of turma.students) {
        if (!student.parents.length) continue;

        const approvedParents = new Map<string, string>();
        student.parents.forEach((parent: { name: string; email?: string | null }) => {
          const email = parent.email?.trim().toLowerCase();
          if (!email || !email.includes("@")) return;
          const firstName = parent.name.trim().split(/\s+/)[0] || "encarregado";
          approvedParents.set(email, firstName);
        });

        if (!approvedParents.size) continue;

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
        const blob = await put(`reports/${period.key}/${crypto.randomUUID()}-${safeFileName(student.name)}-${safeFileName(turma.name)}.pdf`, pdf, {
          access: "public",
          addRandomSuffix: true,
          contentType: "application/pdf",
          token: BLOB_READ_WRITE_TOKEN,
        });

        approvedParents.forEach((firstName, email) => {
          recipients.push({
            email,
            reportUrl: blob.url,
            studentName: student.name,
            firstName,
          });
        });
      }
    }

    if (!recipients.length) {
      return NextResponse.json({ success: true, sent: 0, message: "Nenhum encarregado com email encontrado nas turmas selecionadas." });
    }

    const resend = new Resend(RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const logoUrl = `${appUrl.replace(/\/$/, "")}/school-logo.png`;
    const periodLabel = `${formatPeriodDate(period.start)} a ${formatPeriodDate(period.end)}`;
    let sent = 0;

    for (const recipient of recipients) {
      const safeStudentName = escapeHtml(recipient.studentName);
      const result = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: recipient.email,
        subject: `O seu relatório escolar está pronto | ${recipient.studentName}`,
        text: `Saudações, Sr.(a) ${recipient.firstName}.\n\nO relatório escolar de ${recipient.studentName}, referente ao período ${periodLabel}, está disponível neste endereço:\n${recipient.reportUrl}\n\nCom os melhores cumprimentos,\nNova Escola Politécnica do Huambo`,
        html: `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório escolar</title></head><body style="margin:0;padding:0;background:#fff9df;font-family:Arial,Helvetica,sans-serif;color:#173044"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff9df;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff"><tr><td style="background:#d9edf3;padding:24px 32px;border-bottom:4px solid #f3c0bd"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><img src="${logoUrl}" width="56" height="56" alt="Logótipo da Nova Escola Politécnica do Huambo" style="display:block;width:56px;height:56px;object-fit:contain"></td><td valign="middle" style="padding-left:14px"><div style="font-size:18px;font-weight:bold;color:#173044;letter-spacing:.2px">Nova Escola Politécnica do Huambo</div><div style="font-size:10px;letter-spacing:2px;color:#176b8b;margin-top:4px">Garantindo um ensino de qualidade no Huambo</div></td></tr></table></td></tr><tr><td style="padding:38px 40px 34px"><div style="font-size:11px;letter-spacing:2px;color:#176b8b;font-weight:bold">RELATÓRIO ESCOLAR</div><h1 style="font-size:26px;line-height:1.25;color:#173044;margin:12px 0 18px">O seu relatório está pronto para leitura</h1><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 18px">Caro encarregado de educação,</p><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 24px">Temos o prazer de partilhar o relatório escolar de <strong>${safeStudentName}</strong>. A nossa equipa preparou este documento com todo o cuidado para lhe dar uma visão clara da aprendizagem e do progresso do seu educando.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff1c2;border-left:4px solid #f3c0bd;margin:0 0 28px"><tr><td style="padding:16px 18px;color:#405564;font-size:14px;line-height:1.6"><strong style="color:#173044">Período avaliado:</strong> ${periodLabel}<br><strong style="color:#173044">Documento:</strong> relatório escolar em anexo</td></tr></table><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 24px">Consulte o ficheiro PDF anexado a esta mensagem.</p><p style="font-size:15px;line-height:1.7;color:#405564;margin:0">Com os melhores cumprimentos,<br><strong>Nova Escola Politécnica do Huambo</strong></p></td></tr><tr><td style="background:#173044;padding:18px 40px;color:#d9edf3;font-size:11px;line-height:1.5">Este é um envio automático. Para esclarecimentos, contacte a escola.</td></tr></table></td></tr></table></body></html>`,
        ...getReportEmailOverride({ logoUrl, reportUrl: recipient.reportUrl, studentName: recipient.studentName, firstName: recipient.firstName, periodLabel }),
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
