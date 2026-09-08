import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import sharp from "sharp";
import twilio from "twilio";
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

function normalizeAngolaPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("244")) return `+${digits}`;
  return `+244${digits.replace(/^0/, "")}`;
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

async function loadPublicImageDataUrl(fileName: string) {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", fileName));
    return { data: `data:image/png;base64,${bytes.toString("base64")}`, format: "PNG" as const };
  } catch {
    return null;
  }
}

async function loadCircularAvatarDataUrl(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const source = Buffer.from(await response.arrayBuffer());
    const mask = Buffer.from(`<svg width="160" height="160"><circle cx="80" cy="80" r="80" fill="white"/></svg>`);
    const circularPng = await sharp(source)
      .resize(160, 160, { fit: "cover", position: "centre" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    return { data: `data:image/png;base64,${circularPng.toString("base64")}`, format: "PNG" as const };
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
  const channel = searchParams.get("channel") === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
  const period = getWeeklyCoordinationPeriods(new Date().getFullYear()).find((item) => item.key === periodKey);
  if (!period || !turmaId) return NextResponse.json({ error: "Período e turma são obrigatórios." }, { status: 400 });

  const deliveries = await prisma.reportDelivery.findMany({
    where: { turmaId, periodStart: period.start, channel, status: "FAILED" },
    orderBy: [{ student: { name: "asc" } }, { recipientEmail: "asc" }],
    select: { id: true, student: { select: { name: true } }, recipientName: true, recipientEmail: true, error: true, attemptedAt: true },
  });
  return NextResponse.json({ deliveries: deliveries.map((delivery) => ({ ...delivery, studentName: delivery.student.name, attemptedAt: delivery.attemptedAt.toISOString() })) });
}

async function generateStudentReportPdf({
  studentName,
  turmaName,
  gradeScale,
  teacherName,
  periodStart,
  periodEnd,
  hasPreviousPeriod,
  avatarUrl,
  behavior,
  teacherObservation,
  grades,
  weeklyGrades,
  globalGrades,
  weeklyPeriodLabels,
  weeklyPeriodTerms,
  previousGrades,
  absences,
}: {
  studentName: string;
  turmaName: string;
  gradeScale: number;
  teacherName: string;
  periodStart: Date;
  periodEnd: Date;
  hasPreviousPeriod: boolean;
  avatarUrl?: string | null;
  behavior?: string | null;
  teacherObservation?: string | null;
  grades: Array<{ subject: string; value: number; term: string }>;
  weeklyGrades: Array<{ subject: string; value: number; term: string }>;
  globalGrades: Array<{ subject: string; value: number; term: string }>;
  weeklyPeriodLabels: string[];
  weeklyPeriodTerms: string[];
  previousGrades: Array<{ subject: string; value: number; term: string }>;
  absences: Array<{ subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }>;
}) {
  const [logoDataUrl, avatarDataUrl, qrCodeDataUrl] = await Promise.all([
    loadImageDataUrl(),
    loadCircularAvatarDataUrl(avatarUrl),
    loadPublicImageDataUrl("qr-code.png"),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
        const paper = [246, 229, 219] as const;
  const terracotta = [181, 132, 112] as const;
  const ink = [102, 68, 55] as const;
  const drawDotPattern = () => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomStart = pageHeight - 125;
    for (let row = 0; row < 13; row += 1) {
      const progress = row / 12;
      const radius = 0.45 + progress * 1.5;
      doc.setFillColor(250 - Math.round(progress * 18), 224 - Math.round(progress * 34), 208 - Math.round(progress * 42));
      for (let x = 14; x <= pageWidth - 14; x += 15) doc.circle(x, bottomStart + row * 10, radius, "F");
    }
    for (let row = 0; row < 16; row += 1) {
      const progress = row / 15;
      const radius = 0.4 + progress * 1.25;
      doc.setFillColor(249 - Math.round(progress * 16), 222 - Math.round(progress * 28), 205 - Math.round(progress * 34));
      for (let x = pageWidth - 78; x <= pageWidth - 12; x += 14) doc.circle(x, 104 + row * 14, radius, "F");
    }
  };
  const drawSchoolHeader = () => {
    if (logoDataUrl) doc.addImage(logoDataUrl.data, logoDataUrl.format, margin, 20, 50, 50);
    if (qrCodeDataUrl) doc.addImage(qrCodeDataUrl.data, qrCodeDataUrl.format, pageWidth - margin - 50, 20, 50, 50);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("NOVA ESCOLA POLITÉCNICA DO HUAMBO", 100, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Rua Vicente Ferreira nº 64, Cidade Baixa - Huambo", 100, 55);
    doc.text("https://www.neph.ao", 100, 67);
  };

  doc.setFillColor(...paper);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");
  drawDotPattern();
  doc.setDrawColor(225, 172, 149);
  doc.setLineWidth(2);
  doc.line(0, 90, 40, 80);
  doc.line(pageWidth - 42, 0, pageWidth, 24);
  drawSchoolHeader();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.text("RELATÓRIO SEMANAL", pageWidth / 2, 112, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${formatPeriodDate(periodStart)} a ${formatPeriodDate(periodEnd)}`, pageWidth / 2, 128, { align: "center" });

  const photoCenterX = 85;
  const photoCenterY = 185;
  const photoRadius = 38;
  doc.setFillColor(190, 185, 178);
  doc.circle(photoCenterX, photoCenterY + 2, photoRadius + 1, "F");
  doc.setFillColor(220, 238, 224);
  doc.circle(photoCenterX, photoCenterY, photoRadius, "F");
  if (avatarDataUrl) doc.addImage(avatarDataUrl.data, avatarDataUrl.format, photoCenterX - 37, photoCenterY - 37, 74, 74);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2.5);
  doc.circle(photoCenterX, photoCenterY, photoRadius, "S");
  doc.setTextColor(...ink);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(studentName, 135, 172);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Turma: ${turmaName}`, 135, 190);
  doc.text("Período semanal", 135, 207);

  const averageValue = grades.length ? grades.reduce((total, grade) => total + Number(grade.value), 0) / grades.length : 0;
  const average = averageValue.toFixed(1);
  const justified = absences.filter((absence) => absence.justified).length;
  const unjustified = absences.length - justified;
  const metrics: Array<[string, string]> = [["Média geral", average], ["Notas", String(grades.length)], ["Faltas", String(absences.length)]];
  if (behavior?.trim()) metrics.push(["Comportamento", behavior.trim()]);
  metrics.forEach(([label, value], index) => {
    const x = margin + index * 130;
    doc.setFillColor(index === 0 ? terracotta[0] : 255, index === 0 ? terracotta[1] : 248, index === 0 ? terracotta[2] : 242);
    doc.roundedRect(x, 250, 118, 58, 7, 7, "F");
    doc.setTextColor(index === 0 ? 255 : ink[0], index === 0 ? 255 : ink[1], index === 0 ? 255 : ink[2]);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 10, 268);
    doc.setTextColor(index === 0 ? 255 : ink[0], index === 0 ? 255 : ink[1], index === 0 ? 255 : ink[2]);
    doc.setFontSize(index === 3 ? 12 : 20);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 10, 294);
    doc.setFont("helvetica", "normal");
  });

  let y = 345;
  doc.setTextColor(...ink);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Desempenho por disciplina", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  const subjectAverages = Array.from(new Set(grades.map((grade) => grade.subject))).map((subject) => ({ subject, value: grades.filter((grade) => grade.subject === subject).reduce((total, grade) => total + Number(grade.value), 0) / grades.filter((grade) => grade.subject === subject).length }));
  const previousSubjectAverages = new Map(Array.from(new Set(previousGrades.map((grade) => grade.subject))).map((subject) => [subject, previousGrades.filter((grade) => grade.subject === subject).reduce((total, grade) => total + Number(grade.value), 0) / previousGrades.filter((grade) => grade.subject === subject).length]));
  const chartWidth = pageWidth - margin * 2;
  const passThreshold = gradeScale * 0.5;
  const highThreshold = gradeScale * 0.7;
  const lightenColor = (color: [number, number, number]): [number, number, number] => color.map((channel) => Math.round(channel + (255 - channel) * 0.55)) as [number, number, number];
  const getGradeColor = (value: number): [number, number, number] => value >= highThreshold ? [57, 117, 93] : value >= passThreshold ? [215, 139, 48] : [194, 74, 67];
  subjectAverages.forEach((item) => {
    const label = item.subject.length > 18 ? `${item.subject.slice(0, 17)}...` : item.subject;
    doc.setFontSize(9);
    doc.setTextColor(64, 85, 76);
    doc.text(label, margin, y + 10);
    doc.setFillColor(236, 211, 198);
    doc.roundedRect(margin + 105, y, chartWidth - 145, 14, 4, 4, "F");
    const gradeColor = getGradeColor(item.value);
    const previousValue = previousSubjectAverages.get(item.subject);
    if (hasPreviousPeriod && previousValue !== undefined) {
      const previousColor = lightenColor(getGradeColor(previousValue));
      doc.setFillColor(...previousColor);
      doc.roundedRect(margin + 105, y, (chartWidth - 145) * Math.min(1, previousValue / gradeScale), 14, 4, 4, "F");
    }
    doc.setFillColor(...gradeColor);
    doc.roundedRect(margin + 105, y, (chartWidth - 145) * Math.min(1, item.value / gradeScale), 14, 4, 4, "F");
    if (hasPreviousPeriod && previousValue !== undefined) {
      const previousX = margin + 105 + (chartWidth - 145) * Math.min(1, previousValue / gradeScale);
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(previousValue.toFixed(1), Math.min(previousX + 3, pageWidth - margin - 45), y + 10);
    }
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.text(item.value.toFixed(1), pageWidth - margin - 28, y + 10);
    doc.setFont("helvetica", "normal");
    y += 23;
  });
  if (!subjectAverages.length) { doc.setTextColor(96, 113, 104); doc.text("Sem notas registadas.", margin, y + 10); y += 28; }

  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.setFillColor(194, 74, 67);
  doc.circle(margin + 4, y + 4, 4, "F");
  doc.text(`0-${Math.max(0, passThreshold - 1).toFixed(0)}`, margin + 12, y + 7);
  doc.setFillColor(215, 139, 48);
  doc.circle(margin + 48, y + 4, 4, "F");
  doc.text(`${passThreshold.toFixed(0)}-${Math.max(0, highThreshold - 1).toFixed(0)}`, margin + 56, y + 7);
  doc.setFillColor(57, 117, 93);
  doc.circle(margin + 105, y + 4, 4, "F");
  doc.text(`${highThreshold.toFixed(0)}-${gradeScale}`, margin + 113, y + 7);
  const lowGrades = grades.filter((grade) => Number(grade.value) < passThreshold).length;
  const middleGrades = grades.filter((grade) => Number(grade.value) >= passThreshold && Number(grade.value) < highThreshold).length;
  const highGrades = grades.filter((grade) => Number(grade.value) >= highThreshold).length;
  doc.text(`Notas: ${lowGrades} abaixo de ${passThreshold.toFixed(0)} · ${middleGrades} entre ${passThreshold.toFixed(0)}-${Math.max(0, highThreshold - 1).toFixed(0)} · ${highGrades} entre ${highThreshold.toFixed(0)}-${gradeScale}`, margin + 180, y + 7);
  if (hasPreviousPeriod) {
    doc.setFillColor(190, 190, 190);
    doc.roundedRect(margin, y + 17, 12, 6, 2, 2, "F");
    doc.text("barra clara = período anterior", margin + 18, y + 23);
    y += 17;
  }
  y += 22;

  doc.addPage();
  doc.setFillColor(...paper);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");
  drawDotPattern();
  drawSchoolHeader();
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Detalhe do relatório", margin, 112);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${studentName} · ${turmaName}`, margin, 130);
  doc.text(`${formatPeriodDate(periodStart)} a ${formatPeriodDate(periodEnd)}`, margin, 146);
  const detailPhotoX = pageWidth - margin - 28;
  const detailPhotoY = 122;
  doc.setFillColor(190, 185, 178);
  doc.circle(detailPhotoX, detailPhotoY + 2, 29, "F");
  doc.setFillColor(220, 238, 224);
  doc.circle(detailPhotoX, detailPhotoY, 28, "F");
  if (avatarDataUrl) doc.addImage(avatarDataUrl.data, avatarDataUrl.format, detailPhotoX - 27, detailPhotoY - 27, 54, 54);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.circle(detailPhotoX, detailPhotoY, 28, "S");

  const pageHeight = doc.internal.pageSize.getHeight();
  const detailBottom = pageHeight - 48;
  let detailY = 184;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 23;
  const startDetailContinuation = () => {
    doc.addPage();
    doc.setFillColor(...paper);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    drawDotPattern();
    drawSchoolHeader();
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Detalhe do relatório (continuação)", margin, 112);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${studentName} · ${turmaName}`, margin, 130);
    doc.text(`${formatPeriodDate(periodStart)} a ${formatPeriodDate(periodEnd)}`, margin, 146);
    const continuationPhotoX = pageWidth - margin - 28;
    const continuationPhotoY = 122;
    doc.setFillColor(190, 185, 178);
    doc.circle(continuationPhotoX, continuationPhotoY + 2, 29, "F");
    doc.setFillColor(220, 238, 224);
    doc.circle(continuationPhotoX, continuationPhotoY, 28, "F");
    if (avatarDataUrl) doc.addImage(avatarDataUrl.data, avatarDataUrl.format, continuationPhotoX - 27, continuationPhotoY - 27, 54, 54);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(2);
    doc.circle(continuationPhotoX, continuationPhotoY, 28, "S");
    detailY = 184;
  };
  const ensureDetailSpace = (height: number, continuationColumns?: Array<{ label: string; width: number }>) => {
    if (detailY + height > detailBottom) {
      startDetailContinuation();
      if (continuationColumns) drawTableHeader(continuationColumns);
    }
  };
  const drawTableHeader = (columns: Array<{ label: string; width: number; align?: "left" | "center" }>) => {
    ensureDetailSpace(rowHeight);
    let x = margin;
    doc.setFillColor(...terracotta);
    doc.rect(margin, detailY, tableWidth, rowHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    columns.forEach((column) => {
      doc.text(column.label, column.align === "center" ? x + column.width / 2 : x + 7, detailY + 15, column.align === "center" ? { align: "center" } : undefined);
      x += column.width;
    });
    detailY += rowHeight;
  };

  const subjectGrades = Array.from(new Set(weeklyGrades.map((grade) => grade.subject)));
  const weeklyColumns = weeklyPeriodLabels.length;
  const gradeValueColumnWidth = 58;
  const gradeColumns = [
    { label: "Disciplina", width: tableWidth - (weeklyColumns + 1) * gradeValueColumnWidth },
    ...weeklyPeriodLabels.map((label) => ({ label, width: gradeValueColumnWidth, align: "center" as const })),
    { label: "AC1*", width: gradeValueColumnWidth, align: "center" as const },
  ];
  const absenceColumns = [{ label: "Disciplina", width: 170 }, { label: "Data", width: 85 }, { label: "Tempo", width: 75 }, { label: "Tipo / estado", width: tableWidth - 330 }];
  doc.text("Notas registadas", margin, detailY - 14);
  drawTableHeader(gradeColumns);
  doc.setFont("helvetica", "normal");
  subjectGrades.forEach((subject, index) => {
    ensureDetailSpace(rowHeight, gradeColumns);
    doc.setFillColor(index % 2 ? 255 : 252, index % 2 ? 248 : 241, index % 2 ? 244 : 235);
    doc.rect(margin, detailY, tableWidth, rowHeight, "F");
    doc.setTextColor(...ink);
    doc.setFontSize(9);
    doc.text(subject, margin + 7, detailY + 15);
    const subjectWeeklyGrades = weeklyGrades.filter((grade) => grade.subject === subject);
    weeklyPeriodTerms.forEach((term, weekIndex) => {
      const value = subjectWeeklyGrades.find((grade) => grade.term === term)?.value;
      const columnCenter = margin + gradeColumns[0].width + weekIndex * gradeValueColumnWidth + gradeValueColumnWidth / 2;
      if (value === undefined) {
        doc.setTextColor(120, 120, 120);
        doc.text("-", columnCenter, detailY + 15, { align: "center" });
      } else {
        const numericValue = Number(value);
        const gradeColor = getGradeColor(numericValue);
        doc.setTextColor(...gradeColor);
        doc.text(numericValue.toFixed(1), columnCenter, detailY + 15, { align: "center" });
      }
    });
    const subjectGlobalGrades = globalGrades.filter((grade) => grade.subject === subject);
    const subjectAverage = subjectGlobalGrades.length ? subjectGlobalGrades.reduce((total, grade) => total + Number(grade.value), 0) / subjectGlobalGrades.length : 0;
    const averageColor = getGradeColor(subjectAverage);
    doc.setTextColor(...averageColor);
    doc.text(subjectAverage.toFixed(1), margin + tableWidth - gradeValueColumnWidth / 2, detailY + 15, { align: "center" });
    detailY += rowHeight;
  });
  if (!subjectGrades.length) {
    doc.setTextColor(96, 113, 104);
    doc.text("Sem notas registadas.", margin + 7, detailY + 15);
    detailY += rowHeight;
  }
  detailY += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const ac1NoteLines = doc.splitTextToSize("* AC1: média calculada com todas as notas semanais registadas, não apenas as semanas apresentadas.", tableWidth);
  ensureDetailSpace(ac1NoteLines.length * 10 + 4);
  doc.setTextColor(96, 113, 104);
  doc.text(ac1NoteLines, margin, detailY + 9, { lineHeightFactor: 1.2 });
  detailY += ac1NoteLines.length * 10 + 40;
  ensureDetailSpace(rowHeight * 2);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Resumo de faltas: Justificadas: ${justified} · Injustificadas: ${unjustified}`, margin, detailY - 12);
  detailY += 18;
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Faltas registadas", margin, detailY - 12);
  drawTableHeader(absenceColumns);
  doc.setFont("helvetica", "normal");
  absences.forEach((absence, index) => {
    ensureDetailSpace(rowHeight, absenceColumns);
    doc.setFillColor(index % 2 ? 255 : 252, index % 2 ? 248 : 241, index % 2 ? 244 : 235);
    doc.rect(margin, detailY, tableWidth, rowHeight, "F");
    doc.setTextColor(...ink);
    doc.setFontSize(8);
    doc.text(absence.subject, margin + 7, detailY + 15);
    doc.text(absence.dia.toISOString().slice(0, 10), margin + 177, detailY + 15);
    doc.text(absence.tempo, margin + 262, detailY + 15);
    doc.text(`${absence.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material"} · ${absence.justified ? "Justificada" : "Injustificada"}`, margin + 337, detailY + 15);
    detailY += rowHeight;
  });
  if (!absences.length) {
    doc.setTextColor(96, 113, 104);
    doc.text("Sem faltas registadas.", margin + 7, detailY + 15);
    detailY += rowHeight;
  }

  const absencesBySubject = Array.from(absences.reduce((counts, absence) => {
    counts.set(absence.subject, (counts.get(absence.subject) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries())
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 3);
  if (absencesBySubject.length) {
    detailY += 20;
    ensureDetailSpace(23 + absencesBySubject.length * 27);
    detailY += 21;
    const topAbsenceCount = Math.max(1, absencesBySubject[0][1]);
    absencesBySubject.forEach(([subject, count]) => {
      ensureDetailSpace(27);
      const label = subject.length > 20 ? `${subject.slice(0, 19)}...` : subject;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(label, margin, detailY + 11);
      doc.setFillColor(239, 240, 234);
      doc.roundedRect(margin + 125, detailY, chartWidth - 165, 16, 5, 5, "F");
      doc.setFillColor(181, 132, 112);
      doc.roundedRect(margin + 125, detailY, (chartWidth - 165) * count / topAbsenceCount, 16, 5, 5, "F");
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(String(count), pageWidth - margin - 28, detailY + 11);
      detailY += 27;
    });
  }

  const observationText = teacherObservation?.trim() ?? "";
  const observationWidth = tableWidth - 70;
  const observationX = margin + 18;
  const observationFontSize = 14;
  const observationLineHeight = 17;
  const observationLines = observationText ? doc.splitTextToSize(observationText, observationWidth) : [];
  const signatureName = teacherName.trim() || "Professor(a)";
  if (observationText) {
    detailY += 30;
    ensureDetailSpace(20 + observationLines.length * observationLineHeight + 34);
  }
  const drawObservationQuote = (quoteY: number) => {
    doc.setTextColor(226, 202, 193);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(82);
    doc.text('"', margin + 3, quoteY + 62);
    doc.text('"', pageWidth - margin - 48, quoteY + 62);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };
  if (observationText && detailY + 20 + observationLines.length * observationLineHeight > detailBottom) {
    startDetailContinuation();
    drawObservationQuote(detailY + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(observationFontSize);
    doc.text(observationLines, observationX, detailY + 20, { lineHeightFactor: observationLineHeight / observationFontSize, maxWidth: observationWidth });
    detailY += 20 + observationLines.length * observationLineHeight;
  } else if (observationText) {
    drawObservationQuote(detailY + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(observationFontSize);
    doc.text(observationLines, observationX, detailY + 20, { lineHeightFactor: observationLineHeight / observationFontSize, maxWidth: observationWidth });
    detailY += 20 + observationLines.length * observationLineHeight;
  }
  if (observationText) {
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text(signatureName, pageWidth - margin - 12, detailY + 24, { align: "right" });
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
    const preview = body.preview === true;
    const channel = body.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
    const rawTurmaIds = Array.isArray(body.turmaIds) ? body.turmaIds : [];
    const turmaIds = rawTurmaIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value));
    const rawStudentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const studentIds = rawStudentIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value));
    const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
    const periods = getWeeklyCoordinationPeriods(new Date().getFullYear());
    const periodIndex = periods.findIndex((item) => item.key === periodKey);
    const period = periodIndex >= 0 ? periods[periodIndex] : undefined;
    const previousPeriod = periodIndex > 0 ? periods[periodIndex - 1] : undefined;

    if (!period) {
      return NextResponse.json({ error: "Selecione um período semanal válido." }, { status: 400 });
    }

    if (period.key > formatPeriodDate(new Date())) {
      return NextResponse.json({ error: "Não é possível enviar relatórios de um período futuro." }, { status: 400 });
    }

    if (!turmaIds.length || (body.studentIds && !studentIds.length)) {
      return NextResponse.json({ error: "Selecione pelo menos uma turma ou um aluno" }, { status: 400 });
    }
    if (preview && studentIds.length !== 1) {
      return NextResponse.json({ error: "Selecione exatamente um aluno para pré-visualizar o relatório." }, { status: 400 });
    }

    const { RESEND_API_KEY, RESEND_FROM_EMAIL, BLOB_READ_WRITE_TOKEN, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
    if (!preview && channel === "EMAIL" && (!RESEND_API_KEY || !RESEND_FROM_EMAIL)) {
      return NextResponse.json({ error: "Resend não está configurado. Adicione RESEND_API_KEY e RESEND_FROM_EMAIL." }, { status: 500 });
    }
    if (!preview && channel === "WHATSAPP" && (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM)) {
      return NextResponse.json({ error: "Twilio WhatsApp não está configurado. Adicione TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM." }, { status: 500 });
    }
    if (!preview && !BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "O armazenamento de relatórios não está configurado. Adicione BLOB_READ_WRITE_TOKEN." }, { status: 500 });
    }

    const periodStartDate = new Date(`${formatPeriodDate(period.start)}T00:00:00.000Z`);
    const periodStartNextDate = new Date(periodStartDate.getTime() + 24 * 60 * 60 * 1000);
    const currentPeriodStart = formatPeriodDate(period.start);
    const currentPeriodEnd = formatPeriodDate(period.end);
    const previousPeriodStart = previousPeriod ? formatPeriodDate(previousPeriod.start) : null;
    const previousPeriodEnd = previousPeriod ? formatPeriodDate(previousPeriod.end) : null;
    const pastWeeklyPeriods = periods.slice(Math.max(0, periodIndex - 4), periodIndex + 1);
    const futureWeeklyPeriods = periods.slice(periodIndex + 1, periodIndex + 1 + Math.max(0, 5 - pastWeeklyPeriods.length));
    const weeklyPeriods = [...pastWeeklyPeriods, ...futureWeeklyPeriods];
    const weeklyPeriodTerms = weeklyPeriods.map((weeklyPeriod) => `Semanal:${formatPeriodDate(weeklyPeriod.start)}:${formatPeriodDate(weeklyPeriod.end)}`);
    const weeklyPeriodLabels = weeklyPeriods.map((weeklyPeriod) => `${String(weeklyPeriod.start.getDate()).padStart(2, "0")}/${String(weeklyPeriod.start.getMonth() + 1).padStart(2, "0")}`);
    const absenceStart = previousPeriodStart ?? currentPeriodStart;

    const turmas = await prisma.turma.findMany({
      where: { id: { in: turmaIds } },
      include: {
        coordinator: { select: { name: true } },
        teacherAssignments: {
          where: { isMain: true, teacher: { role: "COORDENADOR" } },
          select: { teacher: { select: { name: true } } },
          take: 1,
        },
        students: {
          include: {
            parents: { select: { id: true, name: true, email: true, phone: true } },
            weeklyObservations: { where: { weekStart: { gte: periodStartDate, lt: periodStartNextDate } }, select: { behavior: true, teacherObservation: true } },
            grades: { where: { term: { startsWith: "Semanal:" } } },
            absences: { where: { dia: { gte: new Date(`${absenceStart}T00:00:00Z`), lte: new Date(`${currentPeriodEnd}T23:59:59.999Z`) } } },
          },
        },
      },
    });

    const recipients: Array<{ email: string; phone: string; reportUrl: string; studentName: string; firstName: string; studentId: string; turmaId: string; recipientName: string }> = [];
    const saveDelivery = (data: { turmaId: string; studentId: string; recipientName?: string; recipientEmail: string; reportUrl?: string; status: "SENT" | "FAILED"; error?: string }) => prisma.reportDelivery.upsert({
      where: { studentId_periodStart_recipientEmail_channel: { studentId: data.studentId, periodStart: period.start, recipientEmail: data.recipientEmail, channel } },
      update: { turmaId: data.turmaId, periodEnd: period.end, recipientName: data.recipientName, reportUrl: data.reportUrl, status: data.status, error: data.error, attemptedAt: new Date() },
      create: { ...data, channel, periodStart: period.start, periodEnd: period.end },
    });

    for (const turma of turmas) {
      for (const student of turma.students) {
        if (studentIds.length && !studentIds.includes(student.id)) continue;
        const currentTerm = `Semanal:${currentPeriodStart}:${currentPeriodEnd}`;
        const previousTerm = previousPeriodStart && previousPeriodEnd ? `Semanal:${previousPeriodStart}:${previousPeriodEnd}` : "";
        const currentStartTime = new Date(`${formatPeriodDate(period.start)}T00:00:00Z`).getTime();
        const currentEndTime = new Date(`${formatPeriodDate(period.end)}T23:59:59.999Z`).getTime();
        const currentGrades = student.grades.filter((grade) => grade.term === currentTerm);
        const previousGrades = student.grades.filter((grade) => grade.term === previousTerm);
        const weeklyGrades = student.grades.filter((grade) => weeklyPeriodTerms.includes(grade.term));
        const globalGrades = student.grades;
        const currentAbsences = student.absences.filter((absence) => absence.dia.getTime() >= currentStartTime && absence.dia.getTime() <= currentEndTime);
        const reportTeacherName = turma.teacherAssignments[0]?.teacher.name ?? turma.coordinator?.name ?? "";
        if (preview) {
          const pdf = await generateStudentReportPdf({
            studentName: student.name,
            turmaName: turma.name,
            gradeScale: turma.gradeScale,
            teacherName: reportTeacherName,
            periodStart: period.start,
            periodEnd: period.end,
            hasPreviousPeriod: Boolean(previousPeriod),
            avatarUrl: student.avatarUrl,
            behavior: student.weeklyObservations[0]?.behavior,
            teacherObservation: student.weeklyObservations[0]?.teacherObservation,
            grades: currentGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
            weeklyGrades: weeklyGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
            globalGrades: globalGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
            weeklyPeriodLabels,
            weeklyPeriodTerms,
            previousGrades: previousGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
            absences: currentAbsences.map((absence: { subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }) => ({ subject: absence.subject, dia: absence.dia, tempo: absence.tempo, faultType: absence.faultType, justified: absence.justified })),
          });
          return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${safeFileName(student.name)}-preview.pdf"` } });
        }
        if (!student.parents.length) {
          await saveDelivery({ turmaId: turma.id, studentId: student.id, recipientEmail: "(sem email)", status: "FAILED", error: "Aluno sem encarregado registado." });
          continue;
        }

        const approvedParents = new Map<string, { firstName: string; phone: string; email: string }>();
        for (const parent of student.parents) {
          const email = parent.email?.trim().toLowerCase();
          const phone = parent.phone ? normalizeAngolaPhone(parent.phone) : "";
          const recipient = channel === "EMAIL" ? email : phone;
          if (!recipient || (channel === "EMAIL" ? !recipient.includes("@") : recipient.length < 8)) {
            await saveDelivery({ turmaId: turma.id, studentId: student.id, recipientName: parent.name, recipientEmail: recipient || `(sem ${channel === "EMAIL" ? "email" : "telefone"} ${parent.name})`, status: "FAILED", error: channel === "EMAIL" ? "O encarregado não tem um endereço de e-mail válido." : "O encarregado não tem um número de WhatsApp válido." });
            continue;
          }
          const firstName = parent.name.trim().split(/\s+/)[0] || "encarregado";
          approvedParents.set(recipient, { firstName, phone, email: email ?? "" });
        }

        if (!approvedParents.size) continue;

        const pdf = await generateStudentReportPdf({
          studentName: student.name,
          turmaName: turma.name,
          gradeScale: turma.gradeScale,
          teacherName: reportTeacherName,
          periodStart: period.start,
          periodEnd: period.end,
          hasPreviousPeriod: Boolean(previousPeriod),
          avatarUrl: student.avatarUrl,
          behavior: student.weeklyObservations[0]?.behavior,
          teacherObservation: student.weeklyObservations[0]?.teacherObservation,
          grades: currentGrades.map((grade: { subject: string; value: number | string; term: string }) => ({
            subject: grade.subject,
            value: Number(grade.value),
            term: grade.term,
          })),
          weeklyGrades: weeklyGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
          globalGrades: globalGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
          weeklyPeriodLabels,
          weeklyPeriodTerms,
          previousGrades: previousGrades.map((grade: { subject: string; value: number | string; term: string }) => ({ subject: grade.subject, value: Number(grade.value), term: grade.term })),
          absences: currentAbsences.map((absence: { subject: string; dia: Date; tempo: string; faultType: string; justified: boolean }) => ({
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

        approvedParents.forEach(({ firstName, phone }, recipient) => {
          recipients.push({
            email: recipient,
            phone: channel === "WHATSAPP" ? recipient : phone,
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
      return NextResponse.json({ success: true, sent: 0, message: `Nenhum encarregado com ${channel === "EMAIL" ? "email" : "número de WhatsApp"} válido encontrado nas turmas selecionadas.` });
    }

    const resend = channel === "EMAIL" ? new Resend(RESEND_API_KEY) : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const logoUrl = `${appUrl.replace(/\/$/, "")}/school-logo.png`;
    const periodLabel = `${formatPeriodDate(period.start)} a ${formatPeriodDate(period.end)}`;
    let sent = 0;
    const results: Array<{ email: string; studentName: string; success: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      if (channel === "WHATSAPP") {
        try {
          await twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!).messages.create({
            from: TWILIO_WHATSAPP_FROM!.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM! : `whatsapp:${TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:${recipient.phone}`,
            body: `Saudações, Sr.(a) ${recipient.firstName}.\n\nO relatório escolar de ${recipient.studentName}, referente ao período ${periodLabel}, está disponível neste link:\n${recipient.reportUrl}\n\nCom os melhores cumprimentos,\nNova Escola Politécnica do Huambo`,
          });
          sent += 1;
          await saveDelivery({ turmaId: recipient.turmaId, studentId: recipient.studentId, recipientName: recipient.recipientName, recipientEmail: recipient.email, reportUrl: recipient.reportUrl, status: "SENT" });
          results.push({ email: recipient.email, studentName: recipient.studentName, success: true });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
          await saveDelivery({ turmaId: recipient.turmaId, studentId: recipient.studentId, recipientName: recipient.recipientName, recipientEmail: recipient.email, reportUrl: recipient.reportUrl, status: "FAILED", error: errorMessage });
          results.push({ email: recipient.email, studentName: recipient.studentName, success: false, error: errorMessage });
        }
        continue;
      }
      const safeStudentName = escapeHtml(recipient.studentName);
      try {
      const result = await resend!.emails.send({
        from: RESEND_FROM_EMAIL!,
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
