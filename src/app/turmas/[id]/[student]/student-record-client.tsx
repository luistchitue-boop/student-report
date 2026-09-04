"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ContactosTab } from "./contactos-tab";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

type GradeRecord = { id: string; subject: string; value: number; term: string; createdAt: string };
type AbsenceRecord = { id: string; subject: string; dia: string; tempo: string; faultType: string; notes: string; justified: boolean; justificationTitle: string; justificationNotes: string; createdAt: string };
const tempos = Array.from({ length: 6 }, (_, index) => `${index + 1}º tempo`);

export function StudentRecordClient({ turma, student }: { turma: { id: string; name: string; schedule: string; students: number; subjects: string[] }; student: { id: string; name: string; age: number; attendance: string; parents: Array<{ id: string; name: string; phone: string; email: string }> } }) {
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [tab, setTab] = useState<"notas" | "faltas" | "justificativos" | "relatorio" | "contactos">("relatorio");
  const [gradeStart, setGradeStart] = useState("");
  const [gradeEnd, setGradeEnd] = useState("");
  const [reportStart, setReportStart] = useState<string>("");
  const [reportEnd, setReportEnd] = useState<string>("");
  const [behavior, setBehavior] = useState("");
  const [absenceStart, setAbsenceStart] = useState("");
  const [absenceEnd, setAbsenceEnd] = useState("");
  const [reportNote, setReportNote] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [justificationStart, setJustificationStart] = useState("");
  const [justificationEnd, setJustificationEnd] = useState("");
  const [selectedAbsenceIds, setSelectedAbsenceIds] = useState<string[]>([]);
  const [justificationTitle, setJustificationTitle] = useState("");
  const [justificationNotes, setJustificationNotes] = useState("");
  const [showJustificationModal, setShowJustificationModal] = useState(false);

  function isFuturePeriod(periodKey: string) {
    const period = weeklyPeriods.find((item) => item.key === periodKey);
    if (!period) return false;
    return period.start.getTime() > new Date(`${todayKey}T12:00:00`).getTime();
  }

  function isCurrentPeriod(periodKey: string) {
    const period = weeklyPeriods.find((item) => item.key === periodKey);
    if (!period) return false;
    const todayTime = new Date(`${todayKey}T12:00:00`).getTime();
    return period.start.getTime() <= todayTime && period.end.getTime() >= todayTime;
  }

  function periodStatus(periodKey: string) {
    if (isCurrentPeriod(periodKey)) return "";
    return isFuturePeriod(periodKey) ? " (futuro)" : " (passado)";
  }

  function selectJustificationPeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setJustificationStart(value);
    setJustificationEnd(period?.end.toISOString().slice(0, 10) ?? "");
  }

  function selectAbsencePeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setAbsenceStart(value);
    setAbsenceEnd(period?.end.toISOString().slice(0, 10) ?? "");
  }

  function selectReportPeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setReportStart(value);
    setReportEnd(period?.end.toISOString().slice(0, 10) ?? "");
  }

  useEffect(() => {
    if (tab !== "notas" && tab !== "faltas" && tab !== "justificativos") return;
    if (tab === "notas" && (!gradeStart || !gradeEnd)) {
      setGrades([]);
      return;
    }
    if (tab === "notas") {
      const start = new Date(`${gradeStart}T12:00:00Z`);
      const end = new Date(`${gradeEnd}T12:00:00Z`);
      if (end.getTime() - start.getTime() !== 6 * 24 * 60 * 60 * 1000) {
        setGrades([]);
        return;
      }
    }
    if (tab === "justificativos" && (!justificationStart || !justificationEnd)) {
      setAbsences([]);
      setRecordsLoading(false);
      return;
    }
    if (tab === "faltas" && (!absenceStart || !absenceEnd)) {
      setAbsences([]);
      setRecordsLoading(false);
      return;
    }
    let cancelled = false;
    setRecordsLoading(true);
    const from = tab === "notas" ? gradeStart : tab === "faltas" ? absenceStart : justificationStart;
    const to = tab === "notas" ? gradeEnd : tab === "faltas" ? absenceEnd : justificationEnd;
    const term = tab === "notas" ? `Semanal:${from}:${to}` : "";
    const termQuery = term ? `&term=${encodeURIComponent(term)}` : "";
    fetch(`/api/student-record?studentId=${encodeURIComponent(student.id)}&from=${from}&to=${to}${termQuery}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os registos.");
        return response.json();
      })
      .then((data: { grades?: GradeRecord[]; absences?: AbsenceRecord[] }) => {
        if (!cancelled) {
          setGrades(data.grades ?? []);
          setAbsences(data.absences ?? []);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar os registos.");
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => { cancelled = true; };
  }, [absenceEnd, absenceStart, gradeEnd, gradeStart, justificationEnd, justificationStart, student.id, tab]);

  async function justifySelectedAbsences() {
    if (!selectedAbsenceIds.length || !justificationTitle.trim() || !justificationNotes.trim()) {
      throw new Error("Selecione faltas e preencha os dois campos.");
    }

    const response = await fetch("/api/student-justifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ absenceIds: selectedAbsenceIds, title: justificationTitle, notes: justificationNotes }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível justificar as faltas.");
    const justifiedIds: string[] = Array.isArray(result.absenceIds) ? result.absenceIds : [];
    setAbsences((current) => current.map((absence) => justifiedIds.includes(absence.id) ? { ...absence, justified: true, justificationTitle: result.title ?? justificationTitle, justificationNotes: result.notes ?? justificationNotes } : absence));
    setSelectedAbsenceIds([]);
    setShowJustificationModal(false);
    setJustificationTitle("");
    setJustificationNotes("");
    setStatusMessage(`${result.justified} falta(s) justificadas.`);
  }

  const validGradePeriod = (() => {
    if (!gradeStart || !gradeEnd) return false;
    const start = new Date(`${gradeStart}T12:00:00Z`);
    const end = new Date(`${gradeEnd}T12:00:00Z`);
    return end.getTime() - start.getTime() === 6 * 24 * 60 * 60 * 1000;
  })();

  async function updateRecord(type: "grade" | "absence", record: GradeRecord | AbsenceRecord) {
    const body = type === "grade"
      ? { type, id: record.id, value: (record as GradeRecord).value, subject: record.subject, term: (record as GradeRecord).term }
      : { type, id: record.id, subject: record.subject, dia: (record as AbsenceRecord).dia.slice(0, 10), tempo: (record as AbsenceRecord).tempo, faultType: (record as AbsenceRecord).faultType, notes: (record as AbsenceRecord).notes };
    const response = await fetch("/api/student-record", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o registo.");
  }

  async function deleteRecord(type: "grade" | "absence", id: string) {
    const response = await fetch(`/api/student-record?type=${type}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível eliminar o registo.");
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function generatePdfReport() {
    if (!reportStart || !reportEnd) {
      setStatusMessage("Escolha um intervalo de datas antes de exportar o relatório.");
      return;
    }

    const startDate = new Date(`${reportStart}T00:00:00Z`);
    const endDate = new Date(`${reportEnd}T23:59:59.999Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      setStatusMessage("A data inicial não pode ser posterior à data final.");
      return;
    }

    try {
      const response = await fetch(`/api/student-record?studentId=${student.id}&from=${reportStart}&to=${reportEnd}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados do aluno.");
      }

      const payload = await response.json();
      const grades = Array.isArray(payload.grades) ? payload.grades : [];
      const faults = Array.isArray(payload.absences) ? payload.absences : [];

      const normalizedGrades: Array<{ subject: string; value: number }> = grades.map((grade: { subject: string; value: number | string }) => ({
        subject: grade.subject,
        value: Number(grade.value),
      }));

      const normalizedFaults: Array<{ subject: string; dia: string; tempo: string; faultType: string; justified: boolean; notes: string }> = faults.map((fault: { subject: string; dia: string; tempo: string; faultType: string; justified?: boolean; notes?: string }) => ({
        subject: fault.subject,
        dia: new Date(fault.dia).toISOString().slice(0, 10),
        tempo: fault.tempo,
        faultType: fault.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material",
        justified: fault.justified === true,
        notes: fault.notes ?? "",
      }));

      const reportElement = document.createElement("div");
      reportElement.style.position = "fixed";
      reportElement.style.left = "-9999px";
      reportElement.style.top = "0";
      reportElement.style.width = "794px";
      reportElement.style.padding = "32px";
      reportElement.style.background = "#fff";
      reportElement.style.fontFamily = "Arial, sans-serif";
      reportElement.style.color = "#1f2a2b";
      reportElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #1b3d34;padding:0 0 20px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <img src="/school-logo.png" alt="Logo da escola" style="width:72px;height:72px;object-fit:contain;" />
            <div><div style="font-size:22px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1b3d34;">NEPH RELATÓRIOS</div><div style="margin-top:7px;color:#60716a;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Relatório escolar</div></div>
          </div>
          <div style="text-align:right;color:#60716a;font-size:11px;line-height:1.6;"><strong style="display:block;color:#1b3d34;font-size:12px;">PERÍODO</strong>${escapeHtml(reportStart)} a ${escapeHtml(reportEnd)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:12px;margin:18px 0 28px;">
          <div style="background:#1b3d34;color:#fff;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#b9d7c4;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Aluno</span><span style="font-size:19px;font-weight:800;">${escapeHtml(student.name)}</span></div>
          <div style="background:#f1f7f2;border:1px solid #d8e7dc;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#5b6d68;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Turma</span><span style="font-size:16px;font-weight:800;color:#1b3d34;">${escapeHtml(turma.name)}</span></div>
          <div style="background:#fff7df;border:1px solid #f0dfaa;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#806b2c;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Média geral</span><span style="font-size:24px;font-weight:800;color:#6d581e;">${normalizedGrades.length ? (normalizedGrades.reduce((total, grade) => total + grade.value, 0) / normalizedGrades.length).toFixed(1) : "0.0"}</span></div>
          <div style="background:#edf4ee;border:1px solid #cfe1d2;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#5b6d68;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Comportamento</span><span style="font-size:16px;font-weight:800;color:#1b3d34;">${escapeHtml(behavior || "Não informado")}</span></div>
        </div>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Notas</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d8e7dc;border-radius:10px;margin-top:10px;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Disciplina</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Nota</th></tr></thead><tbody>${normalizedGrades.length ? normalizedGrades.map((grade, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#ffffff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(grade.subject)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:#1b3d34;">${grade.value.toFixed(1)}</td></tr>`).join("") : `<tr><td colspan="2" style="padding:12px;">Sem notas registadas.</td></tr>`}</tbody></table>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Faltas</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d8e7dc;border-radius:10px;margin-top:10px;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Disciplina</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Dia</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Tempo</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Tipo</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Estado</th></tr></thead><tbody>${normalizedFaults.length ? normalizedFaults.map((fault, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#ffffff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.subject)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.dia)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.tempo)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.faultType)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:${fault.justified ? "#286044" : "#806b2c"};">${fault.justified ? "Justificada" : "Injustificada"}</td></tr>`).join("") : `<tr><td colspan="5" style="padding:12px;">Sem faltas registadas.</td></tr>`}</tbody></table>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Observação do professor</h2>
        <div style="border-left:4px solid #39755d;border-radius:0 10px 10px 0;background:#f1f7f2;padding:15px 17px;line-height:1.6;color:#40554c;">${escapeHtml(reportNote.trim() || "Sem observação do professor.")}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:26px;background:#1b3d34;border-radius:12px;padding:15px 18px;color:#fff;"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b9d7c4;">Resumo de assiduidade</span><span style="font-size:16px;font-weight:800;">${normalizedFaults.length} falta(s) registada(s)</span></div>`;
      document.body.appendChild(reportElement);

      try {
        const reportLogo = reportElement.querySelector("img");
        if (reportLogo && !reportLogo.complete) {
          await new Promise<void>((resolve) => {
            reportLogo.addEventListener("load", () => resolve(), { once: true });
            reportLogo.addEventListener("error", () => resolve(), { once: true });
          });
        }
        const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 18;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png");
        const printableHeight = pageHeight - 18;
        const pixelsPerMillimeter = canvas.width / imgWidth;
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
          pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 9, 9, imgWidth, sourceHeight / pixelsPerMillimeter);
          sourceY += sourceHeight;
        }
        pdf.save(`relatorio-${student.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
        setStatusMessage("PDF gerado com sucesso.");
      } catch (error) {
        console.error("PDF generation failed", error);
        setStatusMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
      } finally {
        reportElement.remove();
      }
    } catch (error) {
      console.error("PDF generation failed", error);
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    }
  }

  return (
    <AppShell active="turmas">
      <main className="main-content student-record-shell" style={{ maxWidth: 900 }}>
        <header className="topbar student-record-topbar" style={{ marginBottom: "1.75rem" }}>
          <div>
            <p className="eyebrow">ALUNO</p>
            <h1 style={{ fontSize: "2rem", letterSpacing: "-0.05em" }}>{student.name}</h1>
          </div>
          <Link href={`/turmas/${turma.id}`} style={{ textDecoration: "none", color: "#39755d", fontWeight: 800 }}>
            ← Voltar à turma
          </Link>
        </header>

        <section className="student-record-panel" style={{ background: "#fff", border: "1px solid #dfe5df", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)" }}>
          <div className="student-tabs" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem", borderBottom: "2px solid #e5ece5", paddingBottom: "1rem", flexWrap: "wrap" }}>
              <button className="student-tab" type="button" onClick={() => setTab("notas")} style={{ border: "none", background: tab === "notas" ? "var(--green-soft)" : "transparent", color: tab === "notas" ? "var(--green)" : "var(--muted)", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s ease", fontSize: "0.85rem" }}>
                Notas
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("faltas")} style={{ border: "none", background: tab === "faltas" ? "var(--green-soft)" : "transparent", color: tab === "faltas" ? "var(--green)" : "var(--muted)", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s ease", fontSize: "0.85rem" }}>
                Faltas
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("justificativos")} style={{ border: "none", background: tab === "justificativos" ? "var(--green-soft)" : "transparent", color: tab === "justificativos" ? "var(--green)" : "var(--muted)", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s ease", fontSize: "0.85rem" }}>
                Justificativos
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("relatorio")} style={{ border: "none", background: tab === "relatorio" ? "var(--green-soft)" : "transparent", color: tab === "relatorio" ? "var(--green)" : "var(--muted)", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s ease", fontSize: "0.85rem" }}>
                Relatório
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("contactos")} style={{ border: "none", background: tab === "contactos" ? "var(--green-soft)" : "transparent", color: tab === "contactos" ? "var(--green)" : "var(--muted)", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s ease", fontSize: "0.85rem" }}>
                Contactos
              </button>
            </div>

            {tab === "notas" && (
              <div className="student-record-list-panel">
                <div className="weekly-period-selector">
                  <label>Período semanal<select value={gradeStart} onChange={(event) => { const period = weeklyPeriods.find((item) => item.key === event.target.value); setGradeStart(event.target.value); setGradeEnd(period ? formatPeriodDate(period.end) : ""); }}><option value="">Selecione um período</option>{weeklyPeriods.map((period) => <option key={period.key} value={period.key} disabled={isFuturePeriod(period.key)}>{period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{isFuturePeriod(period.key) ? " (futuro)" : ""}</option>)}</select></label>
                </div>
                {!gradeStart || !gradeEnd ? <p className="student-record-empty">Selecione o período semanal para ver as notas.</p> : !validGradePeriod ? <p className="student-record-empty record-warning">O período deve ter exatamente 7 dias.</p> : <>
                <div className="student-record-list-heading"><div><p className="eyebrow">HISTÓRICO ACADÉMICO</p><h2>Notas registadas</h2></div><span>{grades.length} registo(s)</span></div>
                {recordsLoading ? <p className="student-record-empty">A carregar notas...</p> : grades.length ? grades.map((grade) => (
                  <div className="student-record-row" key={grade.id}>
                    <label>Disciplina<select value={grade.subject} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, subject: event.target.value } : item))}>{turma.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
                    <label>Nota<input type="number" min="0" max="20" step="0.1" value={grade.value} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, value: Number(event.target.value) } : item))} /></label>
                    <div className="student-record-actions"><button type="button" onClick={async () => { try { await updateRecord("grade", grade); setStatusMessage("Nota atualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar a nota."); } }}>Guardar</button><button type="button" className="danger" onClick={async () => { try { await deleteRecord("grade", grade.id); setGrades((current) => current.filter((item) => item.id !== grade.id)); setStatusMessage("Nota eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a nota."); } }}>Eliminar</button></div>
                  </div>
                )) : <p className="student-record-empty">Nenhuma nota registada.</p>}
                {statusMessage ? <p className="student-record-status">{statusMessage}</p> : null}
                </>}
              </div>
            )}

            {tab === "faltas" && (
              <div className="student-record-list-panel">
                <div className="weekly-period-selector">
                  <label>Período semanal<select value={absenceStart} onChange={(event) => selectAbsencePeriod(event.target.value)}><option value="">Selecione um período</option>{weeklyPeriods.map((period) => <option key={period.key} value={period.key} disabled={isFuturePeriod(period.key)}>{period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{isFuturePeriod(period.key) ? " (futuro)" : ""}</option>)}</select></label>
                </div>
                <div className="student-record-list-heading"><div><p className="eyebrow">HISTÓRICO DE ASSIDUIDADE</p><h2>Faltas registadas</h2></div><span>{absences.length} registo(s)</span></div>
                {!absenceStart || !absenceEnd ? <p className="student-record-empty">Selecione o período semanal para ver as faltas.</p> : recordsLoading ? <p className="student-record-empty">A carregar faltas...</p> : absences.length ? absences.map((absence) => (
                  <div className="student-record-row absence" key={absence.id}>
                    <label>Disciplina<select value={absence.subject} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, subject: event.target.value } : item))}>{turma.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label>
                    <label>Dia<input type="date" max={todayKey} value={absence.dia.slice(0, 10)} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, dia: event.target.value } : item))} /></label>
                    <label>Tempo<select value={absence.tempo} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, tempo: event.target.value } : item))}>{tempos.map((tempo) => <option key={tempo} value={tempo}>{tempo}</option>)}</select></label>
                    <label>Tipo<select value={absence.faultType} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, faultType: event.target.value } : item))}><option value="FALTA_DE_MATERIAL">Falta de material</option><option value="AUSENCIA_NA_SALA">Ausência na sala</option></select></label>
                    <div className="student-record-actions"><button type="button" onClick={async () => { try { await updateRecord("absence", absence); setStatusMessage("Falta atualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar a falta."); } }}>Guardar</button><button type="button" className="danger" onClick={async () => { try { await deleteRecord("absence", absence.id); setAbsences((current) => current.filter((item) => item.id !== absence.id)); setStatusMessage("Falta eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a falta."); } }}>Eliminar</button></div>
                  </div>
                )) : <p className="student-record-empty">Nenhuma falta registada.</p>}
                {statusMessage ? <p className="student-record-status">{statusMessage}</p> : null}
              </div>
            )}

            {tab === "justificativos" && (
              <div className="student-record-list-panel">
                <div className="weekly-period-selector">
                  <label>Período semanal<select value={justificationStart} onChange={(event) => selectJustificationPeriod(event.target.value)}><option value="">Selecione um período</option>{weeklyPeriods.map((period) => <option key={period.key} value={period.key} disabled={!isCurrentPeriod(period.key)}>{period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{periodStatus(period.key)}</option>)}</select></label>
                </div>
                {!justificationStart || !justificationEnd ? <p className="student-record-empty">Selecione o intervalo para ver as faltas.</p> : recordsLoading ? <p className="student-record-empty">A carregar faltas...</p> : (
                  <>
                    <div className="student-record-list-heading"><div><p className="eyebrow">JUSTIFICAÇÃO DE FALTAS</p><h2>Selecione as faltas</h2></div><span>{absences.filter((absence) => !absence.justified).length} por justificar</span></div>
                    {absences.length ? absences.map((absence) => (
                      <label key={absence.id} className={`justification-row ${absence.justified ? "justified" : ""}`}>
                        <input type="checkbox" checked={selectedAbsenceIds.includes(absence.id)} disabled={absence.justified} onChange={() => setSelectedAbsenceIds((current) => current.includes(absence.id) ? current.filter((id) => id !== absence.id) : [...current, absence.id])} />
                        <span><strong>{absence.subject}</strong><small>{absence.dia.slice(0, 10)} · {absence.tempo} · {absence.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material"}</small></span>
                        <span className="justification-status">{absence.justified ? "Justificada" : "Injustificada"}</span>
                      </label>
                    )) : <p className="student-record-empty">Nenhuma falta neste intervalo.</p>}
                    <div className="justification-footer"><span>{selectedAbsenceIds.length} falta(s) selecionada(s)</span><button type="button" className="mini-pauta-save-button" disabled={!selectedAbsenceIds.length} onClick={() => setShowJustificationModal(true)}>Justificar</button></div>
                  </>
                )}
                {statusMessage ? <p className="student-record-status">{statusMessage}</p> : null}
              </div>
            )}

            {tab === "relatorio" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div className="weekly-period-selector">
                  <label>Período semanal<select value={reportStart} onChange={(event) => selectReportPeriod(event.target.value)}><option value="">Selecione um período</option>{weeklyPeriods.map((period) => <option key={period.key} value={period.key} disabled={!isCurrentPeriod(period.key)}>{period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{periodStatus(period.key)}</option>)}</select></label>
                </div>

                <div style={{ display: "grid", gap: "0.55rem" }}>
                  <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                    Observação do professor
                    <textarea
                      rows={4}
                      maxLength={90}
                      value={reportNote}
                      onChange={(event) => setReportNote(event.target.value.slice(0, 90))}
                      placeholder="Escreva uma observação de até 90 caracteres"
                      style={{ padding: "0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8", resize: "vertical" }}
                    />
                  </label>
                  <div style={{ color: "#4a5d5a", fontSize: "0.85rem", fontWeight: 700 }}>
                    {reportNote.length}/90 caracteres
                  </div>
                </div>

                <label className="report-behavior-field">
                  Comportamento
                  <select value={behavior} onChange={(event) => setBehavior(event.target.value)}>
                    <option value="">Selecione uma opção</option>
                    <option value="Muito bom">Muito bom</option>
                    <option value="Bom">Bom</option>
                    <option value="Razoavel">Razoavel</option>
                    <option value="Mau">Mau</option>
                  </select>
                </label>

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <button type="button" onClick={generatePdfReport} disabled={!reportStart || !reportEnd} style={{ padding: "0.9rem 1.2rem", background: !reportStart || !reportEnd ? "#a7b7af" : "#39755d", color: "#fff", border: "none", fontWeight: 800, cursor: !reportStart || !reportEnd ? "not-allowed" : "pointer" }}>
                    Gerar relatório em PDF
                  </button>
                  {statusMessage ? (
                    <div style={{ color: "#244d3d", fontWeight: 700 }}>{statusMessage}</div>
                  ) : null}
                </div>
              </div>
            )}

            {tab === "contactos" && (
              <ContactosTab parents={student.parents} />
            )}
          </section>
          {showJustificationModal ? (
            <div className="justification-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowJustificationModal(false); }}>
              <form className="justification-modal" onSubmit={async (event) => { event.preventDefault(); try { await justifySelectedAbsences(); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível justificar as faltas."); } }}>
                <div className="student-record-list-heading"><div><p className="eyebrow">JUSTIFICATIVO</p><h2>Justificar faltas</h2></div><button type="button" className="modal-close" onClick={() => setShowJustificationModal(false)} aria-label="Fechar">×</button></div>
                <label>Título do justificativo<input required value={justificationTitle} onChange={(event) => setJustificationTitle(event.target.value)} /></label>
                <label>Observações<textarea required rows={4} value={justificationNotes} onChange={(event) => setJustificationNotes(event.target.value)} /></label>
                <button type="submit" className="mini-pauta-save-button">Confirmar justificativo</button>
              </form>
            </div>
          ) : null}
        </main>
      </AppShell>
    );
  }
