import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

async function loadImageDataUrl(url?: string | null) {
  try {
    const response = url
      ? await fetch(url)
      : new Response(await readFile(path.join(process.cwd(), "public", "school-logo.png")), { headers: { "Content-Type": "image/png" } });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    const format = contentType === "image/jpeg" ? "JPEG" : contentType === "image/webp" ? "WEBP" : "PNG";
    return { data: `data:${contentType};base64,${bytes.toString("base64")}`, format };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const periodKey = searchParams.get("periodKey") ?? "";
  const turmaId = searchParams.get("turmaId") ?? "";
  const period = getWeeklyCoordinationPeriods(new Date().getFullYear()).find((item) => item.key === periodKey);
  if (!period || !turmaId) return NextResponse.json({ error: "Período e turma são obrigatórios." }, { status: 400 });

  const deliveries = await prisma.reportDelivery.findMany({
    where: { turmaId, periodStart: period.start, status: "FAILED" },
    orderBy: [{ student: { name: "asc" } }, { recipientEmail: "asc" }],
    select: { id: true, student: { select: { name: true } }, recipientName: true, recipientEmail: true, error: true, attemptedAt: true },
  });
  return NextResponse.json({ deliveries: deliveries.map((delivery) => ({ ...delivery, studentName: delivery.student.name, attemptedAt: delivery.attemptedAt.toISOString() })) });
}

async function generateStudentReportPdf({
  studentName,
  turmaName,
  avatarUrl,
  behavior,
  teacherObservation,
  grades,
  absences,
}: {
  studentName: string;
  turmaName: string;
  avatarUrl?: string | null;
  behavior?: string | null;
  teacherObservation?: string | null;
  grades: Array<{ subject: string; value: number; term: string }>;
  absences: Array<{ subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }>;
}) {
  const [logoDataUrl, avatarDataUrl] = await Promise.all([loadImageDataUrl(), loadImageDataUrl(avatarUrl)]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFillColor(27, 57, 52);
  doc.rect(0, 0, pageWidth, 92, "F");
  if (logoDataUrl) doc.addImage(logoDataUrl.data, logoDataUrl.format, margin, 16, 58, 58);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(23);
  doc.text("NEPH Relatórios", 112, 43);
  doc.setFontSize(11);
  doc.text("Relatório escolar semanal", 112, 63);

  if (avatarDataUrl) doc.addImage(avatarDataUrl.data, avatarDataUrl.format, pageWidth - 112, 108, 72, 72);
  doc.setTextColor(27, 57, 52);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(studentName, margin, 125);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(70, 85, 76);
  doc.text(`Turma: ${turmaName}`, margin, 146);

  const averageValue = grades.length ? grades.reduce((total, grade) => total + Number(grade.value), 0) / grades.length : 0;
  const average = averageValue.toFixed(1);
  const justified = absences.filter((absence) => absence.justified).length;
  const unjustified = absences.length - justified;
  const metrics = [["Média geral", average], ["Notas", String(grades.length)], ["Faltas", String(absences.length)], ["Comportamento", behavior || "N/I"]];
  metrics.forEach(([label, value], index) => {
    const x = margin + index * 130;
    doc.setFillColor(index === 0 ? 27 : 239, index === 0 ? 57 : 247, index === 0 ? 52 : 242);
    doc.roundedRect(x, 170, 118, 58, 7, 7, "F");
    doc.setTextColor(index === 0 ? 255 : 91, index === 0 ? 255 : 109, index === 0 ? 255 : 104);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 10, 188);
    doc.setTextColor(index === 0 ? 255 : 27, index === 0 ? 255 : 57, index === 0 ? 255 : 52);
    doc.setFontSize(index === 3 ? 12 : 20);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 10, 214);
    doc.setFont("helvetica", "normal");
  });

  let y = 260;
  doc.setTextColor(27, 57, 52);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Desempenho por disciplina", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  const subjectAverages = Array.from(new Set(grades.map((grade) => grade.subject))).map((subject) => ({ subject, value: grades.filter((grade) => grade.subject === subject).reduce((total, grade) => total + Number(grade.value), 0) / grades.filter((grade) => grade.subject === subject).length }));
  const chartWidth = pageWidth - margin * 2;
  subjectAverages.forEach((item) => {
    const label = item.subject.length > 18 ? `${item.subject.slice(0, 17)}...` : item.subject;
    doc.setFontSize(9);
    doc.setTextColor(64, 85, 76);
    doc.text(label, margin, y + 10);
    doc.setFillColor(224, 235, 226);
    doc.roundedRect(margin + 105, y, chartWidth - 145, 14, 4, 4, "F");
    doc.setFillColor(57, 117, 93);
    doc.roundedRect(margin + 105, y, (chartWidth - 145) * Math.min(1, item.value / 20), 14, 4, 4, "F");
    doc.setTextColor(27, 57, 52);
    doc.text(item.value.toFixed(1), pageWidth - margin - 28, y + 10);
    y += 23;
  });
  if (!subjectAverages.length) { doc.setTextColor(96, 113, 104); doc.text("Sem notas registadas.", margin, y + 10); y += 28; }

  y += 14;
  doc.setTextColor(27, 57, 52);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Assiduidade", margin, y);
  y += 23;
  doc.setFont("helvetica", "normal");
  const absenceTotal = Math.max(1, absences.length);
  const absenceBars: Array<[string, number, [number, number, number]]> = [["Justificadas", justified, [57, 117, 93]], ["Injustificadas", unjustified, [185, 119, 45]]];
  absenceBars.forEach(([label, value, color]) => {
    doc.setFontSize(10);
    doc.setTextColor(64, 85, 76);
    doc.text(String(label), margin, y + 11);
    doc.setFillColor(239, 240, 234);
    doc.roundedRect(margin + 105, y, chartWidth - 145, 16, 5, 5, "F");
    doc.setFillColor(Number(color[0]), Number(color[1]), Number(color[2]));
    doc.roundedRect(margin + 105, y, (chartWidth - 145) * Number(value) / absenceTotal, 16, 5, 5, "F");
    doc.text(String(value), pageWidth - margin - 28, y + 11);
    y += 27;
  });

  y += 18;
  doc.setFontSize(15);
  doc.setTextColor(27, 57, 52);
  doc.setFont("helvetica", "bold");
  doc.text("Observação do professor", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(64, 85, 76);
  doc.text(doc.splitTextToSize(teacherObservation?.trim() || "Sem observação do professor.", chartWidth), margin, y);

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
    const rawStudentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const studentIds = rawStudentIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value));
    const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
    const period = getWeeklyCoordinationPeriods(new Date().getFullYear()).find((item) => item.key === periodKey);

    if (!period) {
      return NextResponse.json({ error: "Selecione um período semanal válido." }, { status: 400 });
    }

    if (period.key > formatPeriodDate(new Date())) {
      return NextResponse.json({ error: "Não é possível enviar relatórios de um período futuro." }, { status: 400 });
    }

    if (!turmaIds.length || (body.studentIds && !studentIds.length)) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma ou um aluno" }, { status: 400 });
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
            weeklyObservations: { where: { weekStart: period.start }, select: { behavior: true, teacherObservation: true } },
            grades: { where: { term: `Semanal:${formatPeriodDate(period.start)}:${formatPeriodDate(period.end)}` } },
            absences: { where: { dia: { gte: new Date(`${formatPeriodDate(period.start)}T00:00:00Z`), lte: new Date(`${formatPeriodDate(period.end)}T23:59:59.999Z`) } } },
          },
        },
      },
    });

    const recipients: Array<{ email: string; reportUrl: string; studentName: string; firstName: string; studentId: string; turmaId: string; recipientName: string }> = [];
    const saveDelivery = (data: { turmaId: string; studentId: string; recipientName?: string; recipientEmail: string; reportUrl?: string; status: "SENT" | "FAILED"; error?: string }) => prisma.reportDelivery.upsert({
      where: { studentId_periodStart_recipientEmail: { studentId: data.studentId, periodStart: period.start, recipientEmail: data.recipientEmail } },
      update: { turmaId: data.turmaId, periodEnd: period.end, recipientName: data.recipientName, reportUrl: data.reportUrl, status: data.status, error: data.error, attemptedAt: new Date() },
      create: { ...data, periodStart: period.start, periodEnd: period.end },
    });

    for (const turma of turmas) {
      for (const student of turma.students) {
        if (studentIds.length && !studentIds.includes(student.id)) continue;
        if (!student.parents.length) {
          await saveDelivery({ turmaId: turma.id, studentId: student.id, recipientEmail: "(sem email)", status: "FAILED", error: "Aluno sem encarregado registado." });
          continue;
        }

        const approvedParents = new Map<string, string>();
        for (const parent of student.parents) {
          const email = parent.email?.trim().toLowerCase();
          if (!email || !email.includes("@")) {
            await saveDelivery({ turmaId: turma.id, studentId: student.id, recipientName: parent.name, recipientEmail: email || `(sem email ${parent.name})`, status: "FAILED", error: "O encarregado não tem um endereço de e-mail válido." });
            continue;
          }
          const firstName = parent.name.trim().split(/\s+/)[0] || "encarregado";
          approvedParents.set(email, firstName);
        }

        if (!approvedParents.size) continue;

        const pdf = await generateStudentReportPdf({
          studentName: student.name,
          turmaName: turma.name,
          avatarUrl: student.avatarUrl,
          behavior: student.weeklyObservations[0]?.behavior,
          teacherObservation: student.weeklyObservations[0]?.teacherObservation,
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
            studentId: student.id,
            turmaId: turma.id,
            recipientName: firstName,
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
    const results: Array<{ email: string; studentName: string; success: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      const safeStudentName = escapeHtml(recipient.studentName);
      try {
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
        await saveDelivery({ turmaId: recipient.turmaId, studentId: recipient.studentId, recipientName: recipient.recipientName, recipientEmail: recipient.email, reportUrl: recipient.reportUrl, status: "SENT" });
        results.push({ email: recipient.email, studentName: recipient.studentName, success: true });
      } else {
        await saveDelivery({ turmaId: recipient.turmaId, studentId: recipient.studentId, recipientName: recipient.recipientName, recipientEmail: recipient.email, reportUrl: recipient.reportUrl, status: "FAILED", error: result.error.message });
        results.push({ email: recipient.email, studentName: recipient.studentName, success: false, error: result.error.message });
      }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        await saveDelivery({ turmaId: recipient.turmaId, studentId: recipient.studentId, recipientName: recipient.recipientName, recipientEmail: recipient.email, reportUrl: recipient.reportUrl, status: "FAILED", error: errorMessage });
        results.push({ email: recipient.email, studentName: recipient.studentName, success: false, error: errorMessage });
      }
    }

    const failed = results.length - sent;
    return NextResponse.json({ success: failed === 0, sent, failed, total: recipients.length, successRate: recipients.length ? Math.round((sent / recipients.length) * 100) : 0, results });
  } catch (error) {
    console.error("Admin report dispatch error:", error);
    return NextResponse.json({ error: "Não foi possível enviar os relatórios." }, { status: 500 });
  }
}
