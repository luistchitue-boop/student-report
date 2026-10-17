import { jsPDF } from "jspdf";

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
  student: { name: string; turma: { name: string } };
  teacher: { name: string } | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export function generateInternshipReportPdf(report: InternshipPdfReport) {
  const document = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = 52;

  document.setFillColor(23, 48, 68);
  document.rect(0, 0, pageWidth, 106, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(17);
  document.text("Nova Escola Politécnica do Huambo", margin, 46);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text("ESTÁGIO PROFISSIONAL · RELATÓRIO DE ACOMPANHAMENTO", margin, 68);

  y = 139;
  document.setTextColor(23, 48, 68);
  document.setFont("helvetica", "bold");
  document.setFontSize(21);
  document.text(report.student.name, margin, y);
  y += 23;
  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.setTextColor(75, 91, 103);
  document.text(`Turma: ${report.student.turma.name}`, margin, y);
  y += 20;
  document.text(`Período: ${formatDate(report.periodStart)} — ${formatDate(report.periodEnd)}`, margin, y);

  const drawSection = (heading: string, value: string) => {
    const lines = document.splitTextToSize(value || "—", contentWidth) as string[];
    const lineHeight = 15;
    y += 24;
    if (y + 22 > pageHeight - 52) {
      document.addPage();
      y = 54;
    }
    document.setFont("helvetica", "bold");
    document.setFontSize(11);
    document.setTextColor(23, 48, 68);
    document.text(heading.toUpperCase(), margin, y);
    y += 17;
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.setTextColor(55, 69, 80);
    for (const line of lines) {
      if (y > pageHeight - 48) {
        document.addPage();
        y = 54;
      }
      document.text(line, margin, y);
      y += lineHeight;
    }
  };

  document.setFillColor(235, 243, 246);
  document.roundedRect(margin, y + 15, contentWidth, 46, 7, 7, "F");
  document.setFont("helvetica", "bold");
  document.setFontSize(11);
  document.setTextColor(23, 48, 68);
  document.text(`Avaliação global: ${report.performanceRating}/5`, margin + 14, y + 43);
  y += 68;

  const details = [
    ["Empresa de acolhimento", report.companyName || "Não indicada"],
    ["Função / área", report.position || "Não indicada"],
    ["Coordenador responsável", report.teacher?.name || "Não indicado"],
  ];
  for (const [label, value] of details) {
    document.setFont("helvetica", "bold");
    document.setFontSize(9);
    document.setTextColor(100, 116, 126);
    document.text(`${label}:`, margin, y);
    document.setFont("helvetica", "normal");
    document.setTextColor(55, 69, 80);
    document.text(value, margin + 145, y);
    y += 17;
  }

  drawSection("Pontos fortes", report.strengths);
  drawSection("Aspetos a desenvolver", report.improvementAreas);
  drawSection("Observações e recomendações", report.comments);

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(220, 228, 232);
    document.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(110, 124, 133);
    document.text("Documento confidencial · Acompanhamento de estágio", margin, pageHeight - 20);
    document.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}
