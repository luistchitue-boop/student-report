"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useState } from "react";

type Turma = {
  id: string;
  name: string;
  subjects: string[];
  roster: Array<{ id: string; name: string; age: number }>;
};

function displayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? name;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function MiniPautaClient({ turma }: { turma: Turma }) {
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [subject, setSubject] = useState(turma.subjects[0] ?? "");
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportSubject, setExportSubject] = useState(turma.subjects[0] ?? "");
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  function changeWeekStart(value: string) {
    setWeekStart(value);
    setWeekEnd(value ? addDays(value, 6) : "");
  }

  useEffect(() => {
    if (!weekStart || !weekEnd || !subject) {
      setGrades({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/mini-pauta?turmaId=${encodeURIComponent(turma.id)}&subject=${encodeURIComponent(subject)}&weekStart=${weekStart}&weekEnd=${weekEnd}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as notas.");
        return response.json();
      })
      .then((data: { grades?: Array<{ studentId: string; value: number }>; alreadyRecorded?: boolean }) => {
        if (!cancelled) {
          setGrades(Object.fromEntries((data.grades ?? []).map((grade) => [grade.studentId, String(grade.value)])));
          setAlreadyRecorded(Boolean(data.alreadyRecorded ?? (data.grades ?? []).length > 0));
          if (data.alreadyRecorded || (data.grades ?? []).length > 0) {
            setStatus("Já existe uma mini pauta para esta disciplina no intervalo seleccionado. Não pode guardar novamente o mesmo período.");
          } else {
            setStatus("");
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Não foi possível carregar as notas.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subject, turma.id, weekEnd, weekStart]);

  async function saveGrades() {
    if (!weekStart || !weekEnd || !subject) {
      setStatus("Escolha a disciplina e o intervalo semanal antes de guardar.");
      return;
    }

    if (alreadyRecorded) {
      setStatus("Já existe uma mini pauta para esta disciplina no intervalo semanal seleccionado. Não pode guardar novamente o mesmo período.");
      return;
    }

    const gradeEntries = Object.entries(grades)
      .filter(([, value]) => value.trim() !== "")
      .map(([studentId, value]) => ({ studentId, value: Number(value) }));

    if (gradeEntries.some((entry) => !Number.isFinite(entry.value) || entry.value < 0 || entry.value > 20)) {
      setStatus("As notas devem estar entre 0 e 20.");
      return;
    }

    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/mini-pauta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id, subject, weekStart, weekEnd, grades: gradeEntries }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar a mini pauta.");
      setStatus(`${data.saved} nota(s) guardada(s) para o intervalo seleccionado.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar a mini pauta.");
    } finally {
      setIsSaving(false);
    }
  }

  function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  async function exportGrades() {
    if (!exportStart || !exportEnd || !exportSubject) {
      setExportStatus("Escolha o intervalo e a disciplina.");
      return;
    }

    const start = new Date(`${exportStart}T12:00:00Z`);
    const end = new Date(`${exportEnd}T12:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      setExportStatus("O intervalo seleccionado não é válido.");
      return;
    }
    setIsExporting(true);
    setExportStatus("");
    try {
      const response = await fetch(`/api/mini-pauta?export=true&turmaId=${encodeURIComponent(turma.id)}&subject=${encodeURIComponent(exportSubject)}&weekStart=${exportStart}&weekEnd=${exportEnd}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as notas.");

      const scores = (data.grades ?? []) as Array<{ studentId: string; value: number }>;
      const students = (data.students ?? turma.roster) as Array<{ id: string; name: string }>;
      const average = scores.length ? scores.reduce((total, score) => total + Number(score.value), 0) / scores.length : 0;
      const scoreByStudent = new Map(scores.map((score) => [score.studentId, Number(score.value)]));
      const reportElement = document.createElement("div");
      reportElement.style.position = "fixed";
      reportElement.style.left = "-9999px";
      reportElement.style.top = "0";
      reportElement.style.width = "794px";
      reportElement.style.padding = "34px";
      reportElement.style.background = "#fff";
      reportElement.style.fontFamily = "Arial, sans-serif";
      reportElement.style.color = "#1f2a2b";
      reportElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #1b3d34;padding-bottom:18px;"><div style="display:flex;align-items:center;gap:15px;"><img src="/school-logo.png" alt="Logo da escola" style="width:68px;height:68px;object-fit:contain;" /><div><div style="color:#1b3d34;font-size:21px;font-weight:800;letter-spacing:.08em;">NEPH RELATORIOS</div><div style="margin-top:6px;color:#60716a;font-size:11px;text-transform:uppercase;letter-spacing:.12em;">Mini pauta</div></div></div><div style="text-align:right;color:#60716a;font-size:11px;"><strong style="display:block;color:#1b3d34;">INTERVALO</strong>${escapeHtml(exportStart)} a ${escapeHtml(exportEnd)}</div></div><div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin:22px 0 26px;"><div style="background:#1b3d34;color:#fff;border-radius:12px;padding:17px 19px;"><span style="display:block;color:#b9d7c4;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;">Disciplina</span><strong style="font-size:20px;">${escapeHtml(exportSubject)}</strong></div><div style="background:#fff7df;border:1px solid #f0dfaa;border-radius:12px;padding:17px 19px;"><span style="display:block;color:#806b2c;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;">Média aritmética</span><strong style="font-size:25px;color:#6d581e;">${average.toFixed(1)}</strong><span style="display:block;margin-top:4px;color:#806b2c;font-size:10px;">${scores.length} nota(s) considerada(s)</span></div></div><h2 style="color:#1b3d34;font-size:17px;margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Notas por aluno</h2><table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d8e7dc;border-radius:10px;overflow:hidden;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Aluno</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Nota</th></tr></thead><tbody>${students.map((student, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#fff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(student.name)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:#1b3d34;">${scoreByStudent.has(student.id) ? scoreByStudent.get(student.id)!.toFixed(1) : "Não avaliado"}</td></tr>`).join("")}</tbody></table><div style="margin-top:25px;padding:13px 16px;border-left:4px solid #39755d;border-radius:0 10px 10px 0;background:#f1f7f2;color:#40554c;font-size:11px;">A média aritmética considera apenas as notas registadas para esta disciplina no intervalo seleccionado.</div>`;
      document.body.appendChild(reportElement);
      const logo = reportElement.querySelector("img");
      if (logo && !logo.complete) await new Promise<void>((resolve) => { logo.addEventListener("load", () => resolve(), { once: true }); logo.addEventListener("error", () => resolve(), { once: true }); });
      const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth - 18;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const printableHeight = pageHeight - 18;
      const pixelsPerMillimeter = canvas.width / imageWidth;
      const pageSliceHeight = Math.floor(printableHeight * pixelsPerMillimeter);
      let sourceY = 0;
      while (sourceY < canvas.height) {
        const sourceHeight = Math.min(pageSliceHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("Não foi possível preparar uma página do PDF.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
        if (sourceY > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 9, 9, imageWidth, sourceHeight / pixelsPerMillimeter);
        sourceY += sourceHeight;
      }
      pdf.save(`mini-pauta-${exportSubject.toLowerCase().replace(/\s+/g, "-")}-${exportStart}.pdf`);
      reportElement.remove();
      setShowExportModal(false);
      setExportStatus("");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="main-content mini-pauta-shell">
      <header className="topbar turma-topbar">
        <div>
          <p className="eyebrow">AVALIAÇÃO SEMANAL</p>
          <h1>Mini pauta</h1>
          <p className="mini-pauta-subtitle">{turma.name}</p>
        </div>
        <Link href={`/turmas/${turma.id}`} className="dashboard-link">← Voltar à turma</Link>
      </header>

      <section className="mini-pauta-panel">
        <div className="mini-pauta-toolbar">
          <label>Disciplina<select value={subject} onChange={(event) => setSubject(event.target.value)}>{turma.subjects.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
          <label>Início da semana<input type="date" value={weekStart} onChange={(event) => changeWeekStart(event.target.value)} /></label>
          <label>Fim da semana<input type="date" value={weekEnd} onChange={(event) => setWeekEnd(event.target.value)} /></label>
        </div>

        <div className="mini-pauta-heading">
          <div><p className="eyebrow">NOTAS DOS ALUNOS</p><h2>{subject || "Escolha uma disciplina"}</h2></div>
          <span className="mini-pauta-range">{weekStart && weekEnd ? `${weekStart} a ${weekEnd}` : "Intervalo de 7 dias"}</span>
        </div>

        <div className="mini-pauta-list">
          {turma.roster.map((student) => (
            <label key={student.id} className="mini-pauta-row">
              <span className="mini-pauta-avatar">{displayName(student.name).charAt(0).toUpperCase()}</span>
              <span className="mini-pauta-student"><strong>{displayName(student.name)}</strong></span>
              <span className="mini-pauta-input-wrap"><span>Nota</span><input type="number" min="0" max="20" step="0.1" value={grades[student.id] ?? ""} onChange={(event) => setGrades((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="-" disabled={!weekStart || !weekEnd} /></span>
            </label>
          ))}
        </div>

        <div className="mini-pauta-footer">
          <span>{isLoading ? "A carregar notas..." : `${Object.values(grades).filter(Boolean).length} de ${turma.roster.length} alunos avaliados`}</span>
          <div className="mini-pauta-footer-actions"><button type="button" className="mini-pauta-export-button" onClick={() => { setExportSubject(subject); setShowExportModal(true); }}>Export</button><button type="button" className="mini-pauta-save-button" onClick={saveGrades} disabled={isSaving || isLoading || alreadyRecorded}>{isSaving ? "A guardar..." : "Guardar notas"}</button></div>
        </div>
        {status ? <p className="mini-pauta-status">{status}</p> : null}
      </section>
      {showExportModal ? <div className="mini-pauta-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowExportModal(false); }}><form className="mini-pauta-export-modal" onSubmit={(event) => { event.preventDefault(); void exportGrades(); }}><div className="mini-pauta-modal-heading"><div><p className="eyebrow">EXPORTAR MINI PAUTA</p><h2>Gerar relatório</h2></div><button type="button" className="mini-pauta-modal-close" onClick={() => setShowExportModal(false)} aria-label="Fechar">×</button></div><label>Disciplina<select value={exportSubject} onChange={(event) => setExportSubject(event.target.value)}>{turma.subjects.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label>Início do intervalo<input required type="date" value={exportStart} onChange={(event) => setExportStart(event.target.value)} /></label><label>Fim do intervalo<input required type="date" value={exportEnd} onChange={(event) => setExportEnd(event.target.value)} /></label><p className="mini-pauta-export-help">A média será calculada com todas as notas registadas para a disciplina e intervalo seleccionados.</p>{exportStatus ? <p className="mini-pauta-status">{exportStatus}</p> : null}<button type="submit" className="mini-pauta-save-button" disabled={isExporting}>{isExporting ? "A gerar..." : "Exportar PDF"}</button></form></div> : null}
    </main>
  );
}
