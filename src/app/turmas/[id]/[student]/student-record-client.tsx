"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useMemo, useState } from "react";

const subjects = ["Matemática", "Português", "Ciências", "História", "Educação Física", "Arte"];
const tempos = Array.from({ length: 6 }, (_, index) => `${index + 1}º tempo`);
const faultTypes = ["Falta de material", "Ausência na sala"];

const emptyGrades = Object.fromEntries(subjects.map((subject) => [subject, ""]));

export function StudentRecordClient({ turma, student }: { turma: { id: string; name: string; schedule: string; students: number }; student: { id: string; name: string; age: number; attendance: string } }) {
  const [tab, setTab] = useState<"notas" | "faltas" | "relatorio">("notas");
  const [gradeStart, setGradeStart] = useState<string>("");
  const [gradeEnd, setGradeEnd] = useState<string>("");
  const [reportStart, setReportStart] = useState<string>("");
  const [reportEnd, setReportEnd] = useState<string>("");
  const [gradeValues, setGradeValues] = useState<Record<string, string>>(emptyGrades);
  const [reportNote, setReportNote] = useState<string>("");
  const [absenceRows, setAbsenceRows] = useState([
    { subject: "Matemática", dia: "", tempo: "1º tempo", faultType: "Falta de material", notes: "" },
  ]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const hasValidGradeWindow = (() => {
    if (!gradeStart || !gradeEnd) return false;
    const start = new Date(`${gradeStart}T12:00:00Z`);
    const end = new Date(`${gradeEnd}T12:00:00Z`);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays === 6;
  })();

  const studentSlug = useMemo(
    () => student.name.toLowerCase().replace(/\s+/g, "-") ,
    [student.name],
  );

  function addAbsenceRow() {
    setAbsenceRows((current) => [
      ...current,
      { subject: "Português", dia: "", tempo: "1º tempo", faultType: "Falta de material", notes: "" },
    ]);
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

      const normalizedFaults: Array<{ subject: string; dia: string; tempo: string; faultType: string; notes: string }> = faults.map((fault: { subject: string; dia: string; tempo: string; faultType: string; notes?: string }) => ({
        subject: fault.subject,
        dia: new Date(fault.dia).toISOString().slice(0, 10),
        tempo: fault.tempo,
        faultType: fault.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material",
        notes: fault.notes ?? "",
      }));

      const averageScore = normalizedGrades.length
        ? (normalizedGrades.reduce((total: number, grade: { value: number }) => total + Number(grade.value), 0) / normalizedGrades.length).toFixed(1)
        : "0.0";

      const totalFaults = normalizedFaults.length;

      const reportElement = document.createElement("div");
      reportElement.style.position = "fixed";
      reportElement.style.left = "-9999px";
      reportElement.style.top = "0";
      reportElement.style.width = "794px";
      reportElement.style.background = "#fff";
      reportElement.style.padding = "32px";
      reportElement.style.fontFamily = "Arial, sans-serif";
      reportElement.style.color = "#1f2a2b";
      reportElement.innerHTML = `
        <div style="border-bottom:2px solid #1b3d34;padding-bottom:16px;margin-bottom:24px;">
          <div style="font-size:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1b3d34;">AEph Reports</div>
          <h1 style="margin:8px 0 0;color:#1b3d34;font-size:28px;">Relatório escolar</h1>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:12px;margin:18px 0 24px;">
          <div style="background:#f5faf6;border:1px solid #dfe5df;padding:12px 14px;">
            <span style="display:block;color:#5b6d68;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Aluno</span>
            <span style="font-size:16px;font-weight:700;">${escapeHtml(student.name)}</span>
          </div>
          <div style="background:#f5faf6;border:1px solid #dfe5df;padding:12px 14px;">
            <span style="display:block;color:#5b6d68;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Turma</span>
            <span style="font-size:16px;font-weight:700;">${escapeHtml(turma.name)}</span>
          </div>
          <div style="background:#f5faf6;border:1px solid #dfe5df;padding:12px 14px;">
            <span style="display:block;color:#5b6d68;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Média</span>
            <span style="font-size:16px;font-weight:700;">${averageScore}</span>
          </div>
        </div>

        <h2 style="color:#1b3d34;font-size:18px;margin:22px 0 10px;border-bottom:1px solid #dfe5df;padding-bottom:6px;">Notas</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Disciplina</th>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Nota</th>
            </tr>
          </thead>
          <tbody>
            ${normalizedGrades.length ? normalizedGrades.map((grade) => `<tr><td style="border:1px solid #d6ddd5;padding:10px 12px;">${escapeHtml(grade.subject)}</td><td style="border:1px solid #d6ddd5;padding:10px 12px;">${Number(grade.value).toFixed(1)}</td></tr>`).join("") : `<tr><td colspan="2" style="border:1px solid #d6ddd5;padding:10px 12px;">Sem notas registadas.</td></tr>`}
          </tbody>
        </table>

        <h2 style="color:#1b3d34;font-size:18px;margin:22px 0 10px;border-bottom:1px solid #dfe5df;padding-bottom:6px;">Faltas</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Disciplina</th>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Dia</th>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Tempo</th>
              <th style="border:1px solid #d6ddd5;padding:10px 12px;text-align:left;background:#edf5ee;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Tipo</th>
            </tr>
          </thead>
          <tbody>
            ${normalizedFaults.length ? normalizedFaults.map((fault) => `<tr><td style="border:1px solid #d6ddd5;padding:10px 12px;">${escapeHtml(fault.subject)}</td><td style="border:1px solid #d6ddd5;padding:10px 12px;">${escapeHtml(fault.dia)}</td><td style="border:1px solid #d6ddd5;padding:10px 12px;">${escapeHtml(fault.tempo)}</td><td style="border:1px solid #d6ddd5;padding:10px 12px;">${escapeHtml(fault.faultType)}</td></tr>`).join("") : `<tr><td colspan="4" style="border:1px solid #d6ddd5;padding:10px 12px;">Sem faltas registadas.</td></tr>`}
          </tbody>
        </table>

        <h2 style="color:#1b3d34;font-size:18px;margin:22px 0 10px;border-bottom:1px solid #dfe5df;padding-bottom:6px;">Observação do professor</h2>
        <div style="border:1px solid #dfe5df;background:#f7faf7;padding:14px 16px;line-height:1.6;">${escapeHtml(reportNote.trim() || "Sem observação do professor.")}</div>

        <div style="margin-top:22px;background:#fff;border:1px solid #dfe5df;padding:12px 14px;">
          <span style="display:block;color:#5b6d68;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Resumo</span>
          <span style="font-size:16px;font-weight:700;">${totalFaults} falta(s) registada(s) neste relatório.</span>
        </div>
      `;

      document.body.appendChild(reportElement);

      try {
        const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff" });
        const pdf = new jsPDF("p", "mm", "a4");
        const imgData = canvas.toDataURL("image/png");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 18;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const finalHeight = Math.min(imgHeight, pageHeight - 18);

        pdf.addImage(imgData, "PNG", 9, 9, imgWidth, finalHeight);
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

  async function saveGrades() {
    if (!hasValidGradeWindow) {
      setStatusMessage("A janela semanal precisa ter exatamente 7 dias de diferença.");
      return;
    }

    const grades = subjects
      .map((subject) => {
        const rawValue = gradeValues[subject]?.trim();
        if (rawValue === undefined || rawValue === "") {
          return null;
        }

        const value = Number(rawValue);
        if (!Number.isFinite(value) || value < 0 || value > 20) {
          return null;
        }

        return { subject, value, term: "Semanal" };
      })
      .filter((entry): entry is { subject: string; value: number; term: string } => entry !== null);

    if (!grades.length) {
      setStatusMessage("Insira pelo menos uma nota válida antes de guardar.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/student-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          grades,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível guardar as notas.");
      }

      setStatusMessage("Notas guardadas com sucesso.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível guardar as notas.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAbsences() {
    const absences = absenceRows
      .filter((row) => row.subject && row.dia)
      .map((row) => ({
        studentId: student.id,
        subject: row.subject,
        dia: row.dia,
        tempo: row.tempo,
        faultType: row.faultType === "Ausência na sala" ? "AUSENCIA_NA_SALA" : "FALTA_DE_MATERIAL",
        notes: row.notes ?? "",
      }));

    if (!absences.length) {
      setStatusMessage("Adicione pelo menos uma falta com dia preenchido antes de guardar.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/student-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          absences,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível guardar as faltas.");
      }

      setStatusMessage("Faltas guardadas com sucesso.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível guardar as faltas.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>
            AEph <small>REPORTS</small>
          </span>
        </div>

        <nav>
          <Link href="/" className="">
            <span>▦</span> Reports
          </Link>
          <Link href="/turmas" className="nav-active">
            <span>◫</span> Turmas
          </Link>
          <Link href="/#activity" className="">
            <span>↗</span> Activity
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="help-mark">?</div>
          <div>
            <strong>Need a hand?</strong>
            <small>Read the sending guide</small>
          </div>
        </div>
      </aside>

      <div className="page-shell">
        <main className="main-content" style={{ maxWidth: 900 }}>
          <header className="topbar" style={{ marginBottom: "1.75rem" }}>
            <div>
              <p className="eyebrow">ALUNO</p>
              <h1 style={{ fontSize: "2rem", letterSpacing: "-0.05em" }}>{student.name}</h1>
            </div>
            <Link href={`/turmas/${turma.id}`} style={{ textDecoration: "none", color: "#39755d", fontWeight: 800 }}>
              ← Voltar à turma
            </Link>
          </header>

          <section style={{ background: "#fff", border: "1px solid #dfe5df", padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5ece5", paddingBottom: "0.8rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setTab("notas")} style={{ border: tab === "notas" ? "none" : "1px solid #dfe5df", background: tab === "notas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Notas
              </button>
              <button type="button" onClick={() => setTab("faltas")} style={{ border: tab === "faltas" ? "none" : "1px solid #dfe5df", background: tab === "faltas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Faltas
              </button>
              <button type="button" onClick={() => setTab("relatorio")} style={{ border: tab === "relatorio" ? "none" : "1px solid #dfe5df", background: tab === "relatorio" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Relatório
              </button>
            </div>

            {tab === "notas" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", background: "#f6f9f5", border: "1px solid #dfe5df", padding: "0.9rem" }}>
                  <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                    Data início
                    <input type="date" value={gradeStart} onChange={(event) => setGradeStart(event.target.value)} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                  </label>

                  <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                    Data fim
                    <input type="date" value={gradeEnd} onChange={(event) => setGradeEnd(event.target.value)} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                  </label>
                </div>

                {!hasValidGradeWindow && (gradeStart || gradeEnd) ? (
                  <div style={{ color: "#a14a3a", fontWeight: 700 }}>
                    A semana deve ter exatamente 7 dias de diferença.
                  </div>
                ) : null}

                <div style={{ color: "#4a5d5a", fontSize: "0.92rem", fontWeight: 600 }}>
                  Campos vazios não são guardados.
                </div>

                {subjects.map((subject) => (
                  <div key={subject} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 180px) 1fr", gap: "0.75rem", alignItems: "center", background: "#f7f8f4", border: "1px solid #e3e8e1", padding: "0.75rem 0.9rem" }}>
                    <strong style={{ color: "#32413d" }}>{subject}</strong>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.1"
                      value={gradeValues[subject] ?? ""}
                      onChange={(event) => setGradeValues((current) => ({ ...current, [subject]: event.target.value }))}
                      placeholder="Inserir nota"
                      disabled={!hasValidGradeWindow}
                      style={{ padding: "0.8rem 0.9rem", border: "1px solid #ccd7cc", background: !hasValidGradeWindow ? "#edf1ee" : "#fbfcf8", cursor: !hasValidGradeWindow ? "not-allowed" : "text" }}
                    />
                  </div>
                ))}
                <div style={{ paddingTop: "1rem", borderTop: "1px solid #e5ece5", display: "grid", gap: "0.75rem" }}>
                  {statusMessage ? (
                    <div style={{ color: "#244d3d", fontWeight: 700 }}>{statusMessage}</div>
                  ) : null}
                  <button type="button" onClick={saveGrades} disabled={isSaving || !hasValidGradeWindow} style={{ padding: "0.9rem 1.2rem", background: !hasValidGradeWindow ? "#a7b7af" : "#39755d", color: "#fff", border: "none", fontWeight: 800, cursor: isSaving || !hasValidGradeWindow ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving ? "A guardar..." : "Guardar notas"}
                  </button>
                </div>
              </div>
            )}

            {tab === "faltas" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                {absenceRows.map((row, index) => (
                  <div key={`${row.subject}-${index}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", background: "#f7f8f4", border: "1px solid #e3e8e1", padding: "0.85rem" }}>
                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Disciplina
                      <select value={row.subject} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].subject = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {subjects.map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Dia
                      <input type="date" value={row.dia} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].dia = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Tempo
                      <select value={row.tempo} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].tempo = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {tempos.map((tempo) => (
                          <option key={tempo} value={tempo}>{tempo}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Tipo de falta
                      <select value={row.faultType} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].faultType = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {faultTypes.map((faultType) => (
                          <option key={faultType} value={faultType}>{faultType}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d", gridColumn: "1 / -1" }}>
                      Observação
                      <textarea rows={2} value={row.notes} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].notes = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8", resize: "vertical" }} />
                    </label>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <button type="button" onClick={addAbsenceRow} style={{ padding: "0.8rem 1rem", border: "1px solid #dfe5df", background: "#fff", color: "#244d3d", fontWeight: 800, cursor: "pointer" }}>
                    + Adicionar falta
                  </button>
                  <button type="button" onClick={saveAbsences} disabled={isSaving} style={{ padding: "0.9rem 1.2rem", background: "#39755d", color: "#fff", border: "none", fontWeight: 800, cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving ? "A guardar..." : "Guardar faltas"}
                  </button>
                </div>
                {statusMessage ? (
                  <div style={{ color: "#244d3d", fontWeight: 700 }}>{statusMessage}</div>
                ) : null}
              </div>
            )}

            {tab === "relatorio" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", background: "#f6f9f5", border: "1px solid #dfe5df", padding: "0.9rem" }}>
                  <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                    Data início do relatório
                    <input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                  </label>

                  <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                    Data fim do relatório
                    <input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                  </label>
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
          </section>
        </main>
      </div>
    </div>
  );
}
