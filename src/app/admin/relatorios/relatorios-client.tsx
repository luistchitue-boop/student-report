"use client";

import { useState } from "react";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

type Turma = {
  id: string;
  name: string;
  students: number;
  subjects: string[];
  roster: Array<{ id: string; name: string; parents: Array<{ name: string; email: string }> }>;
};

type DeliveryResult = { email: string; studentName: string; success: boolean; error?: string };
type FailedDelivery = { id: string; studentName: string; recipientName?: string | null; recipientEmail: string; error?: string | null; attemptedAt: string };

export function RelatoriosClient({ turmas }: { turmas: Turma[] }) {
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deliveryResults, setDeliveryResults] = useState<DeliveryResult[]>([]);
  const [auditTurmaId, setAuditTurmaId] = useState("");
  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>([]);
  const [auditStatus, setAuditStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  function isFuturePeriod(periodKey: string) {
    return periodKey > formatPeriodDate(new Date());
  }

  function resetFeedback() {
    setMessage("");
    setStatus("idle");
    setDeliveryResults([]);
  }

  async function loadFailedDeliveries() {
    if (!selectedPeriod || !auditTurmaId) return;
    setAuditStatus("loading");
    try {
      const response = await fetch(`/api/admin/reports?periodKey=${encodeURIComponent(selectedPeriod)}&turmaId=${encodeURIComponent(auditTurmaId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar os envios.");
      setFailedDeliveries(data.deliveries ?? []);
      setAuditStatus("loaded");
    } catch (error) {
      setFailedDeliveries([]);
      setAuditStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar os envios.");
    }
  }

  function toggleTurma(turmaId: string) {
    setSelectedTurmas((current) => current.includes(turmaId) ? current.filter((value) => value !== turmaId) : [...current, turmaId]);
    resetFeedback();
  }

  async function handleSendReports(studentId?: string) {
    if (!selectedPeriod) {
      setStatus("error");
      setMessage("Selecione um período semanal antes de enviar.");
      return;
    }

    const selectedStudentTurma = studentId ? turmas.find((turma) => turma.roster.some((student) => student.id === studentId)) : null;
    const turmaIds = studentId ? (selectedStudentTurma ? [selectedStudentTurma.id] : []) : selectedTurmas;
    if (!turmaIds.length) {
      setStatus("error");
      setMessage("Selecione pelo menos uma turma ou um aluno antes de enviar.");
      return;
    }

    setStatus("sending");
    setMessage("");
    setDeliveryResults([]);

    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaIds, periodKey: selectedPeriod, ...(studentId ? { studentIds: [studentId] } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar os relatórios.");

      setStatus(data.failed ? "error" : "success");
      setMessage(`${data.sent ?? 0} de ${data.total ?? 0} e-mail(s) enviado(s). Taxa de sucesso: ${data.successRate ?? 0}%.`);
      setDeliveryResults(data.results ?? []);
      if (!studentId) setSelectedTurmas([]);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro ao enviar os relatórios.");
    }
  }

  return (
    <section className="admin-shell workspace">
      <div className="section-heading admin-heading">
        <div>
          <p className="eyebrow">SELECIONE AS TURMAS</p>
          <h3>Gerar e enviar relatórios por e-mail</h3>
        </div>
      </div>

      <div className="weekly-period-selector admin-report-period">
        <label>Período semanal
          <select value={selectedPeriod} onChange={(event) => { setSelectedPeriod(event.target.value); setSelectedTurmas([]); setSelectedStudentId(""); setFailedDeliveries([]); setAuditStatus("idle"); resetFeedback(); }}>
            <option value="">Selecione um período</option>
            {weeklyPeriods.map((period) => <option key={period.key} value={period.key} disabled={isFuturePeriod(period.key)}>{period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{isFuturePeriod(period.key) ? " (futuro)" : ""}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-turma-panel">
        <div className="admin-turma-grid">
          {turmas.map((turma) => <label key={turma.id} className={`admin-checkbox ${selectedTurmas.includes(turma.id) ? "selected" : ""} ${!selectedPeriod ? "disabled" : ""}`}>
            <input type="checkbox" disabled={!selectedPeriod || status === "sending"} checked={selectedTurmas.includes(turma.id)} onChange={() => toggleTurma(turma.id)} />
            <span><strong>{turma.name}</strong><small>{turma.students} alunos</small></span>
          </label>)}
        </div>
      </div>

      <div className="admin-actions">
        <button className="admin-submit" type="button" onClick={() => handleSendReports()} disabled={status === "sending" || !selectedPeriod || selectedTurmas.length === 0}>{status === "sending" ? "A enviar..." : "Enviar relatórios"}</button>
      </div>

      <div className="admin-individual-panel">
        <label>Testar um caso individual
          <select value={selectedStudentId} disabled={!selectedPeriod || status === "sending"} onChange={(event) => { setSelectedStudentId(event.target.value); resetFeedback(); }}>
            <option value="">Selecione um aluno</option>
            {turmas.flatMap((turma) => turma.roster.map((student) => <option key={student.id} value={student.id}>{student.name} · {turma.name}</option>))}
          </select>
        </label>
        <button type="button" onClick={() => handleSendReports(selectedStudentId)} disabled={status === "sending" || !selectedPeriod || !selectedStudentId}>{status === "sending" ? "A enviar..." : "Enviar caso individual"}</button>
      </div>

      {message && <p className={`admin-status ${status}`}>{message}</p>}

      {deliveryResults.length > 0 && <div className="admin-delivery-results">
        <strong>Resultado do envio</strong>
        {deliveryResults.map((result) => <div key={`${result.studentName}-${result.email}`} className={result.success ? "delivery-success" : "delivery-failure"}><span>{result.studentName} · {result.email}</span><span>{result.success ? "Enviado" : `Falhou: ${result.error ?? "erro desconhecido"}`}</span></div>)}
      </div>}

      <div className="admin-audit-panel">
        <strong>Consultar relatórios não enviados</strong>
        <div className="admin-audit-controls">
          <select value={auditTurmaId} disabled={!selectedPeriod || auditStatus === "loading"} onChange={(event) => { setAuditTurmaId(event.target.value); setFailedDeliveries([]); setAuditStatus("idle"); }}>
            <option value="">Selecione uma turma</option>
            {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
          </select>
          <button type="button" onClick={loadFailedDeliveries} disabled={!selectedPeriod || !auditTurmaId || auditStatus === "loading"}>{auditStatus === "loading" ? "A consultar..." : "Ver falhas"}</button>
        </div>
        {auditStatus === "loaded" && !failedDeliveries.length && <p className="audit-empty">Não foram encontradas falhas para este período e turma.</p>}
        {failedDeliveries.length > 0 && <div className="audit-failures">{failedDeliveries.map((delivery) => <div className="audit-failure" key={delivery.id}><strong>{delivery.studentName}</strong><span>{delivery.recipientName ? `${delivery.recipientName} · ` : ""}{delivery.recipientEmail}</span><small>{delivery.error || "Motivo não informado"}</small></div>)}</div>}
      </div>

      <style>{`
        .admin-shell { display:flex; flex-direction:column; gap:1.5rem; }
        .admin-heading { margin-bottom:0; }
        .admin-turma-panel, .admin-individual-panel, .admin-delivery-results { background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:1.2rem; }
        .admin-report-period { max-width:520px; }
        .admin-turma-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.9rem; }
        .admin-checkbox { display:flex; align-items:center; gap:.7rem; background:#fff; border:1px solid #dbe3ec; border-radius:12px; padding:.9rem 1rem; cursor:pointer; }
        .admin-checkbox.selected { border-color:#1d4ed8; background:#eff6ff; }
        .admin-checkbox.disabled { opacity:.55; cursor:not-allowed; }
        .admin-checkbox input { accent-color:#2563eb; }
        .admin-checkbox span { display:flex; flex-direction:column; gap:.18rem; }
        .admin-checkbox small { color:#64748b; }
        .admin-actions { display:flex; justify-content:flex-start; }
        .admin-submit, .admin-individual-panel button { background:#1d4ed8; color:#fff; border:0; border-radius:10px; padding:.8rem 1.2rem; font-size:.95rem; font-weight:700; cursor:pointer; }
        .admin-submit:disabled, .admin-individual-panel button:disabled { opacity:.6; cursor:not-allowed; }
        .admin-individual-panel { display:flex; align-items:end; gap:1rem; flex-wrap:wrap; }
        .admin-individual-panel label { display:grid; gap:.45rem; flex:1; min-width:260px; font-weight:700; }
        .admin-individual-panel select { padding:.7rem; border:1px solid #cbd5e1; border-radius:8px; background:#fff; }
        .admin-status { margin:0; padding:.85rem 1rem; border-radius:10px; font-size:.92rem; }
        .admin-status.success { background:#dcfce7; color:#166534; }
        .admin-status.error { background:#fee2e2; color:#991b1b; }
        .admin-status.sending { background:#dbeafe; color:#1d4ed8; }
        .admin-delivery-results { display:grid; gap:.65rem; }
        .admin-delivery-results > strong { color:#1e293b; }
        .admin-delivery-results > div { display:flex; justify-content:space-between; gap:1rem; padding:.65rem .75rem; border-radius:8px; font-size:.86rem; }
        .delivery-success { background:#ecfdf5; color:#166534; }
        .delivery-failure { background:#fff1f2; color:#9f1239; }
        .admin-audit-panel { display:grid; gap:.8rem; background:#fff; border:1px solid #dbe3ec; border-radius:18px; padding:1.2rem; }
        .admin-audit-controls { display:flex; gap:.8rem; flex-wrap:wrap; }
        .admin-audit-controls select { flex:1; min-width:220px; padding:.7rem; border:1px solid #cbd5e1; border-radius:8px; background:#fff; }
        .admin-audit-controls button { background:#475569; color:#fff; border:0; border-radius:8px; padding:.7rem 1rem; font-weight:700; cursor:pointer; }
        .admin-audit-controls button:disabled { opacity:.6; cursor:not-allowed; }
        .audit-empty { margin:0; color:#166534; }
        .audit-failures { display:grid; gap:.55rem; }
        .audit-failure { display:grid; gap:.15rem; padding:.75rem; background:#fff1f2; color:#881337; border-radius:8px; }
        .audit-failure span, .audit-failure small { color:#9f1239; }
      `}</style>
    </section>
  );
}
