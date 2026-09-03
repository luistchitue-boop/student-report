"use client";

import { Download } from "lucide-react";
import { jsPDF } from "jspdf";

type ExportPeriod = {
  start: string;
  end: string;
  title: string;
  description: string;
  registered: boolean;
  isTest?: boolean;
};

export function ControloExportButton({
  turmaName,
  coordinatorName,
  year,
  periods,
}: {
  turmaName: string;
  coordinatorName: string;
  year: number;
  periods: ExportPeriod[];
}) {
  function exportPdf() {
    const pdf = new jsPDF();
    const margin = 18;
    let y = 20;

    pdf.setFontSize(18);
    pdf.setTextColor(29, 43, 41);
    pdf.text("Controlo de coordenação semanal", margin, y);
    y += 10;
    pdf.setFontSize(10);
    pdf.setTextColor(90, 105, 97);
    pdf.text(`Turma: ${turmaName}`, margin, y);
    y += 6;
    pdf.text(`Coordenador(a): ${coordinatorName}`, margin, y);
    y += 6;
    pdf.text(`Ano lectivo: ${year}`, margin, y);
    y += 12;

    pdf.setFontSize(9);
    pdf.setTextColor(29, 43, 41);
    pdf.text("PERÍODO", margin, y);
    pdf.text("SITUAÇÃO", 105, y);
    pdf.text("TÍTULO", 140, y);
    y += 5;
    pdf.setDrawColor(210, 222, 213);
    pdf.line(margin, y, 192, y);
    y += 7;

    for (const period of periods) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }

      const start = new Date(period.start).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" });
      const end = new Date(period.end).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" });
      pdf.setTextColor(70, 82, 76);
      pdf.text(`${period.isTest ? "Teste - " : ""}${start} - ${end}`, margin, y);
      pdf.setTextColor(period.registered ? 57 : 154, period.registered ? 117 : 104, period.registered ? 93 : 72);
      pdf.text(period.registered ? "Registado" : "Ausente", 105, y);
      pdf.setTextColor(29, 43, 41);
      pdf.text(period.title ? pdf.splitTextToSize(period.title, 48) : "Sem registo semanal", 140, y);
      y += 9;
    }

    pdf.save(`controlo-${turmaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year}.pdf`);
  }

  function exportReportPdf() {
    const pdf = new jsPDF();
    const margin = 18;
    const contentWidth = 174;
    let y = 20;

    const addText = (text: string, x: number, width: number, lineHeight = 5) => {
      const lines = pdf.splitTextToSize(text, width) as string[];
      if (y + lines.length * lineHeight > 275) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(lines, x, y);
      y += lines.length * lineHeight;
    };

    pdf.setFontSize(18);
    pdf.setTextColor(29, 43, 41);
    pdf.text("Relatório de coordenação semanal", margin, y);
    y += 10;
    pdf.setFontSize(10);
    pdf.setTextColor(90, 105, 97);
    pdf.text(`Turma: ${turmaName}`, margin, y);
    y += 6;
    pdf.text(`Coordenador(a): ${coordinatorName}`, margin, y);
    y += 6;
    pdf.text(`Ano lectivo: ${year}`, margin, y);
    y += 12;

    for (const period of periods) {
      const start = new Date(period.start).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" });
      const end = new Date(period.end).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit" });
      if (y > 260) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(11);
      pdf.setTextColor(57, 117, 93);
      pdf.text(`${period.isTest ? "Teste - " : ""}${start} - ${end}`, margin, y);
      y += 7;
      pdf.setFontSize(12);
      pdf.setTextColor(29, 43, 41);
      addText(period.title || "Sem relatório submetido", margin, contentWidth, 5.5);
      y += 3;
      pdf.setFontSize(10);
      pdf.setTextColor(70, 82, 76);
      addText(period.description || "Não existe descrição para este intervalo.", margin, contentWidth, 5);
      y += 8;
    }

    pdf.save(`relatorio-coordenacao-${turmaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${year}.pdf`);
  }

  return (
    <div className="controlo-export-actions">
      <button type="button" className="controlo-export-button" onClick={exportPdf}>
        <Download size={16} strokeWidth={2.2} /> Exportar PDF
      </button>
      <button type="button" className="controlo-report-button" onClick={exportReportPdf}>
        <Download size={16} strokeWidth={2.2} /> Relatorio
      </button>
    </div>
  );
}