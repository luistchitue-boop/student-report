import { readFileSync } from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import sharp from "sharp";

export type InternshipPdfReport = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  companyName: string | null;
  position: string | null;
  performanceRating: number;
  strengths: string;
  improvementAreas: string;
  comments: string;
  student: { name: string; avatarUrl: string | null; turma: { name: string } };
  teacher: { name: string } | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

function loadPublicPng(fileName: string) {
  try {
    const bytes = readFileSync(path.join(process.cwd(), "public", fileName));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadStudentAvatar(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const source = Buffer.from(await response.arrayBuffer());
    const mask = Buffer.from('<svg width="128" height="128"><circle cx="64" cy="64" r="64" fill="white"/></svg>');
    const circularPng = await sharp(source)
      .rotate()
      .resize(128, 128, { fit: "cover", position: "centre" })
      .composite([{ input: mask, blend: "dest-in" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    return `data:image/png;base64,${circularPng.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function generateInternshipReportPdf(report: InternshipPdfReport) {
  const studentAvatar = await loadStudentAvatar(report.student.avatarUrl);
  const document = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const paper = [246, 229, 219] as const;
  const terracotta = [181, 132, 112] as const;
  const ink = [102, 68, 55] as const;
  const logo = loadPublicPng("school-logo.png");
  const qrCode = loadPublicPng("qr-code.png");
  let y = 0;

  const drawDotPattern = () => {
    const bottomStart = pageHeight - 125;
    for (let row = 0; row < 13; row += 1) {
      const progress = row / 12;
      const radius = 0.45 + progress * 1.5;
      document.setFillColor(250 - Math.round(progress * 18), 224 - Math.round(progress * 34), 208 - Math.round(progress * 42));
      for (let x = 14; x <= pageWidth - 14; x += 15) document.circle(x, bottomStart + row * 10, radius, "F");
    }
    for (let row = 0; row < 16; row += 1) {
      const progress = row / 15;
      const radius = 0.4 + progress * 1.25;
      document.setFillColor(249 - Math.round(progress * 16), 222 - Math.round(progress * 28), 205 - Math.round(progress * 34));
      for (let x = pageWidth - 78; x <= pageWidth - 12; x += 14) document.circle(x, 104 + row * 14, radius, "F");
      for (let x = 12; x <= 78; x += 14) document.circle(x, 14 + row * 14, radius, "F");
    }
  };

  const drawPageBackground = () => {
    document.setFillColor(...paper);
    document.rect(0, 0, pageWidth, pageHeight, "F");
    drawDotPattern();
    document.setDrawColor(225, 172, 149);
    document.setLineWidth(2);
    document.line(0, 90, 40, 80);
    document.line(pageWidth - 42, 0, pageWidth, 24);
    if (logo) document.addImage(logo, "PNG", margin, 20, 50, 50);
    if (qrCode) document.addImage(qrCode, "PNG", pageWidth - margin - 50, 20, 50, 50);
    document.setTextColor(...ink);
    document.setFont("helvetica", "bold");
    document.setFontSize(10);
    document.text("NOVA ESCOLA POLITÉCNICA DO HUAMBO", 100, 42);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text("Rua Vicente Ferreira 60-64, Cidade Baixa, Huambo", 100, 55);
    document.text("https://www.neph.ao", 100, 67);
  };

  const drawSection = (heading: string, value: string) => {
    const lines = document.splitTextToSize(value || "—", contentWidth - 28) as string[];
    const lineHeight = 14;
    const headingHeight = 17;
    const padding = 14;
    const maxContentHeight = pageHeight - 118;
    let lineIndex = 0;

    while (lineIndex < lines.length || lineIndex === 0) {
      const availableHeight = pageHeight - 48 - y;
      if (availableHeight < headingHeight + lineHeight + padding * 2) {
        document.addPage();
        drawPageBackground();
        document.setTextColor(...ink);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.text("Relatório de estágio (continuação)", margin, 112);
        document.setFont("helvetica", "normal");
        document.setFontSize(10);
        document.text(`${report.student.name} · ${report.student.turma.name}`, margin, 130);
        y = 158;
      }

      const usableHeight = Math.min(pageHeight - 48 - y, maxContentHeight);
      const linesPerCard = Math.max(1, Math.floor((usableHeight - headingHeight - padding * 2) / lineHeight));
      const chunk = lines.slice(lineIndex, lineIndex + linesPerCard);
      const cardHeight = headingHeight + padding * 2 + chunk.length * lineHeight;
      document.setFillColor(252, 241, 235);
      document.setDrawColor(225, 172, 149);
      document.roundedRect(margin, y, contentWidth, cardHeight, 9, 9, "FD");
      document.setTextColor(...terracotta);
      document.setFont("helvetica", "bold");
      document.setFontSize(10);
      document.text(heading.toUpperCase(), margin + padding, y + padding + 8);
      document.setTextColor(...ink);
      document.setFont("helvetica", "normal");
      document.setFontSize(10);
      document.text(chunk, margin + padding, y + padding + headingHeight + 5, { lineHeightFactor: 1.2 });
      y += cardHeight + 12;
      lineIndex += chunk.length;
      if (lineIndex < lines.length) {
        document.addPage();
        drawPageBackground();
        document.setTextColor(...ink);
        document.setFont("helvetica", "bold");
        document.setFontSize(14);
        document.text("Relatório de estágio (continuação)", margin, 112);
        document.setFont("helvetica", "normal");
        document.setFontSize(10);
        document.text(`${report.student.name} · ${report.student.turma.name}`, margin, 130);
        y = 158;
      }
      if (!chunk.length) break;
    }
  };

  drawPageBackground();
  document.setTextColor(...ink);
  document.setFont("times", "bold");
  document.setFontSize(22);
  document.text("RELATÓRIO DE ESTÁGIO", pageWidth / 2, 112, { align: "center" });
  document.setFont("times", "normal");
  document.setFontSize(11);
  document.text(`${formatDate(report.periodStart)} a ${formatDate(report.periodEnd)}`, pageWidth / 2, 128, { align: "center" });

  const photoCenterX = margin + 38;
  const photoCenterY = 180;
  document.setFillColor(190, 185, 178);
  document.circle(photoCenterX, photoCenterY + 2, 39, "F");
  document.setFillColor(220, 238, 224);
  document.circle(photoCenterX, photoCenterY, 38, "F");
  if (studentAvatar) {
    document.addImage(studentAvatar, "PNG", photoCenterX - 37, photoCenterY - 37, 74, 74);
  } else {
    document.setFont("helvetica", "bold");
    document.setFontSize(22);
    document.setTextColor(...ink);
    document.text(report.student.name.trim().slice(0, 1).toLocaleUpperCase(), photoCenterX, photoCenterY + 8, { align: "center" });
  }
  document.setDrawColor(255, 255, 255);
  document.setLineWidth(2.5);
  document.circle(photoCenterX, photoCenterY, 38, "S");

  const studentTextX = margin + 88;
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.setTextColor(...ink);
  document.text(document.splitTextToSize(report.student.name, pageWidth - studentTextX - margin) as string[], studentTextX, 172, { maxWidth: pageWidth - studentTextX - margin });
  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.text(`Turma: ${report.student.turma.name}`, studentTextX, 196);
  document.text("Acompanhamento individual · Estágio profissional", studentTextX, 213);

  const cards: Array<[string, string]> = [
    ["AVALIAÇÃO GLOBAL", `${report.performanceRating}/5`],
    ["EMPRESA", report.companyName || "Não indicada"],
    ["FUNÇÃO / ÁREA", report.position || "Não indicada"],
    ["COORDENADOR", report.teacher?.name || "Não indicado"],
  ];
  const cardGap = 8;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    document.setFillColor(index === 0 ? terracotta[0] : 255, index === 0 ? terracotta[1] : 248, index === 0 ? terracotta[2] : 242);
    document.roundedRect(x, 230, cardWidth, 64, 10, 10, "F");
    document.setTextColor(index === 0 ? 255 : ink[0], index === 0 ? 255 : ink[1], index === 0 ? 255 : ink[2]);
    document.setFont("helvetica", "bold");
    document.setFontSize(7);
    document.text(label, x + 8, 247, { maxWidth: cardWidth - 16 });
    document.setFontSize(index === 0 ? 19 : 9);
    document.text(document.splitTextToSize(value, cardWidth - 16) as string[], x + 8, 273, { lineHeightFactor: 1.1 });
  });

  y = 324;
  drawSection("Pontos fortes", report.strengths);
  drawSection("Aspetos a desenvolver", report.improvementAreas);
  drawSection("Observações e recomendações", report.comments);

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(225, 172, 149);
    document.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(...ink);
    document.text("Documento confidencial · Acompanhamento de estágio", margin, pageHeight - 20);
    document.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}
