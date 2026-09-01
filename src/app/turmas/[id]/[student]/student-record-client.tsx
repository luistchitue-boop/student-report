"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useState } from "react";

type GradeRecord = { id: string; subject: string; value: number; term: string; createdAt: string };
type AbsenceRecord = { id: string; subject: string; dia: string; tempo: string; faultType: string; notes: string; createdAt: string };

export function StudentRecordClient({ turma, student }: { turma: { id: string; name: string; schedule: string; students: number; subjects: string[] }; student: { id: string; name: string; age: number; attendance: string; parents: Array<{ id: string; name: string; phone: string; email: string }> } }) {
  const [tab, setTab] = useState<"notas" | "faltas" | "relatorio" | "contactos">("relatorio");
  const [reportStart, setReportStart] = useState<string>("");
  const [reportEnd, setReportEnd] = useState<string>("");
  const [reportNote, setReportNote] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "notas" && tab !== "faltas") return;
    let cancelled = false;
    setRecordsLoading(true);
    fetch(`/api/student-record?studentId=${encodeURIComponent(student.id)}&from=2000-01-01&to=2100-12-31`)
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
  }, [student.id, tab]);

  async function updateRecord(type: "grade" | "absence", record: GradeRecord | AbsenceRecord) {
    const body = type === "grade"
      ? { type, id: record.id, value: (record as GradeRecord).value, subject: record.subject, term: (record as GradeRecord).term }
      : { type, id: record.id, subject: record.subject, dia: (record as AbsenceRecord).dia.slice(0, 10), tempo: (record as AbsenceRecord).tempo, faultType: (record as AbsenceRecord).faultType, notes: (record as AbsenceRecord).notes };
    const response = await fetch("/api/student-record", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível actualizar o registo.");
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

      const normalizedFaults: Array<{ subject: string; dia: string; tempo: string; faultType: string; notes: string }> = faults.map((fault: { subject: string; dia: string; tempo: string; faultType: string; notes?: string }) => ({
        subject: fault.subject,
        dia: new Date(fault.dia).toISOString().slice(0, 10),
        tempo: fault.tempo,
        faultType: fault.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material",
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
      reportElement.innerHTML = `<h1 style="color:#1b3d34;">NEPH RELATORIOS</h1><h2>Relatório de ${escapeHtml(student.name)}</h2><p>Período: ${escapeHtml(reportStart)} a ${escapeHtml(reportEnd)}</p><h3>Notas</h3><ul>${normalizedGrades.map((grade) => `<li>${escapeHtml(grade.subject)}: ${grade.value.toFixed(1)}</li>`).join("") || "<li>Sem notas registadas.</li>"}</ul><h3>Faltas</h3><ul>${normalizedFaults.map((fault) => `<li>${escapeHtml(fault.subject)} - ${escapeHtml(fault.dia)} - ${escapeHtml(fault.faultType)}</li>`).join("") || "<li>Sem faltas registadas.</li>"}</ul><h3>Observação do professor</h3><p>${escapeHtml(reportNote.trim() || "Sem observação do professor.")}</p>`;
      document.body.appendChild(reportElement);

      try {
        const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff" });
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 18;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 9, 9, imgWidth, Math.min(imgHeight, pageHeight - 18));
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" aria-label="Livro">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 20.5z" />
              <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13a2 2 0 0 0-2 2v15a2 2 0 0 1 2-2h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
            </svg>
          </span>
          <span>
            NEPH <small>RELATORIOS</small>
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

          <section className="student-record-panel" style={{ background: "#fff", border: "1px solid #dfe5df", padding: "1.25rem" }}>
            <div className="student-tabs" style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5ece5", paddingBottom: "0.8rem", flexWrap: "wrap" }}>
              <button className="student-tab" type="button" onClick={() => setTab("notas")} style={{ border: tab === "notas" ? "none" : "1px solid #dfe5df", background: tab === "notas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Notas
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("faltas")} style={{ border: tab === "faltas" ? "none" : "1px solid #dfe5df", background: tab === "faltas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Faltas
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("relatorio")} style={{ border: tab === "relatorio" ? "none" : "1px solid #dfe5df", background: tab === "relatorio" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Relatório
              </button>
              <button className="student-tab" type="button" onClick={() => setTab("contactos")} style={{ border: tab === "contactos" ? "none" : "1px solid #dfe5df", background: tab === "contactos" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Contactos
              </button>
            </div>

            {tab === "notas" && (
              <div className="student-record-list-panel">
                <div className="student-record-list-heading"><div><p className="eyebrow">HISTÓRICO ACADÉMICO</p><h2>Notas registadas</h2></div><span>{grades.length} registo(s)</span></div>
                {recordsLoading ? <p className="student-record-empty">A carregar notas...</p> : grades.length ? grades.map((grade) => (
                  <div className="student-record-row" key={grade.id}>
                    <label>Disciplina<input value={grade.subject} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, subject: event.target.value } : item))} /></label>
                    <label>Nota<input type="number" min="0" max="20" step="0.1" value={grade.value} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, value: Number(event.target.value) } : item))} /></label>
                    <label>Período<input value={grade.term} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, term: event.target.value } : item))} /></label>
                    <div className="student-record-actions"><button type="button" onClick={async () => { try { await updateRecord("grade", grade); setStatusMessage("Nota actualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível actualizar a nota."); } }}>Guardar</button><button type="button" className="danger" onClick={async () => { try { await deleteRecord("grade", grade.id); setGrades((current) => current.filter((item) => item.id !== grade.id)); setStatusMessage("Nota eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a nota."); } }}>Eliminar</button></div>
                  </div>
                )) : <p className="student-record-empty">Nenhuma nota registada.</p>}
                {statusMessage ? <p className="student-record-status">{statusMessage}</p> : null}
              </div>
            )}

            {tab === "faltas" && (
              <div className="student-record-list-panel">
                <div className="student-record-list-heading"><div><p className="eyebrow">HISTÓRICO DE ASSIDUIDADE</p><h2>Faltas registadas</h2></div><span>{absences.length} registo(s)</span></div>
                {recordsLoading ? <p className="student-record-empty">A carregar faltas...</p> : absences.length ? absences.map((absence) => (
                  <div className="student-record-row absence" key={absence.id}>
                    <label>Disciplina<input value={absence.subject} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, subject: event.target.value } : item))} /></label>
                    <label>Dia<input type="date" value={absence.dia.slice(0, 10)} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, dia: event.target.value } : item))} /></label>
                    <label>Tempo<input value={absence.tempo} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, tempo: event.target.value } : item))} /></label>
                    <label>Tipo<select value={absence.faultType} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, faultType: event.target.value } : item))}><option value="FALTA_DE_MATERIAL">Falta de material</option><option value="AUSENCIA_NA_SALA">Ausência na sala</option></select></label>
                    <div className="student-record-actions"><button type="button" onClick={async () => { try { await updateRecord("absence", absence); setStatusMessage("Falta actualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível actualizar a falta."); } }}>Guardar</button><button type="button" className="danger" onClick={async () => { try { await deleteRecord("absence", absence.id); setAbsences((current) => current.filter((item) => item.id !== absence.id)); setStatusMessage("Falta eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a falta."); } }}>Eliminar</button></div>
                  </div>
                )) : <p className="student-record-empty">Nenhuma falta registada.</p>}
                {statusMessage ? <p className="student-record-status">{statusMessage}</p> : null}
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

            {tab === "contactos" && (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                <div style={{ color: "#4a5d5a", fontSize: "0.92rem", fontWeight: 600 }}>
                  Contactos dos encarregados de educação.
                </div>
                {student.parents.length ? student.parents.map((parent) => (
                  <article key={parent.id} style={{ display: "grid", gap: "0.55rem", background: "#f7f8f4", border: "1px solid #e3e8e1", padding: "1rem" }}>
                    <strong style={{ color: "#244d3d", fontSize: "1.05rem" }}>{parent.name}</strong>
                    <div style={{ display: "grid", gap: "0.35rem", color: "#4a5d5a" }}>
                      <a href={`tel:${parent.phone}`} style={{ color: "#39755d", fontWeight: 700 }}>{parent.phone || "Telefone não informado"}</a>
                      {parent.email ? (
                        <a href={`mailto:${parent.email}`} style={{ color: "#39755d", overflowWrap: "anywhere" }}>{parent.email}</a>
                      ) : (
                        <span>Email não informado</span>
                      )}
                    </div>
                  </article>
                )) : (
                  <div style={{ color: "#68756d" }}>Nenhum contacto registado.</div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
