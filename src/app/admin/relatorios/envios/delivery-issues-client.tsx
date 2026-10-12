"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";

type DeliveryIssue = {
  id: string;
  turmaId: string;
  turmaName: string;
  studentName: string;
  recipientName: string | null;
  recipientEmail: string;
  status: "FAILED" | "BOUNCED" | "DELAYED";
  error: string | null;
  attemptedAt: string;
};
type TurmaSummary = { id: string; name: string; studentCount: number; sentCount: number; percentage: number; failedCount: number; bouncedCount: number; delayedCount: number };

function getAvailableMonths() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(year - index))
    .flat()
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

const statusLabels: Record<DeliveryIssue["status"], string> = {
  BOUNCED: "Devolvido (bounce)",
  FAILED: "Falhou / não enviado",
  DELAYED: "Atrasado / não entregue",
};

export function DeliveryIssuesClient() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [periodKey, setPeriodKey] = useState(() => months[0]?.key ?? "");
  const [turmaId, setTurmaId] = useState("all");
  const [issues, setIssues] = useState<DeliveryIssue[]>([]);
  const [summary, setSummary] = useState<TurmaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!periodKey) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    fetch(`/api/admin/reports/delivery-status?periodKey=${encodeURIComponent(periodKey)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar os envios.");
        return data as { issues?: DeliveryIssue[]; summary?: TurmaSummary[] };
      })
      .then((data) => {
        if (!cancelled) {
          setIssues(data.issues ?? []);
          setSummary(data.summary ?? []);
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível consultar os envios."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodKey]);

  const filteredIssues = turmaId === "all" ? issues : issues.filter((issue) => issue.turmaId === turmaId);
  const counts = filteredIssues.reduce((result, issue) => ({ ...result, [issue.status]: result[issue.status] + 1 }), { FAILED: 0, BOUNCED: 0, DELAYED: 0 });

  return (
    <section className="delivery-issues-page">
      <div className="delivery-issues-topline"><Link href="/admin/relatorios">← Voltar aos relatórios</Link><span>DETALHE DE ENTREGA</span></div>
      <header className="delivery-issues-heading">
        <div><p className="eyebrow">AUDITORIA DE E-MAIL</p><h2>Falhas e e-mails devolvidos</h2><p>Consulte destinatários com falhas de envio, devoluções ou notificações de atraso do serviço de e-mail.</p></div>
      </header>

      <div className="delivery-issues-filters">
        <label>Período mensal<select value={periodKey} onChange={(event) => setPeriodKey(event.target.value)}>{months.map((month) => <option key={month.key} value={month.key}>{getPeriodLabel(month)}</option>)}</select></label>
        <label>Turma<select value={turmaId} onChange={(event) => setTurmaId(event.target.value)}><option value="all">Todas as turmas</option>{summary.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}</select></label>
      </div>

      <div className="delivery-issue-metrics">
        <article className="metric-bounced"><span>Devolvidos</span><strong>{counts.BOUNCED}</strong></article>
        <article className="metric-failed"><span>Falhas de envio</span><strong>{counts.FAILED}</strong></article>
        <article className="metric-delayed"><span>Atrasados</span><strong>{counts.DELAYED}</strong></article>
      </div>

      {error ? <p className="delivery-issues-feedback error" role="alert">{error}</p> : loading ? <p className="delivery-issues-feedback">A carregar o detalhe dos envios...</p> : !filteredIssues.length ? <div className="delivery-issues-empty"><strong>Nenhuma falha encontrada</strong><span>Não há e-mails devolvidos, falhados ou atrasados para este período e filtro.</span></div> : (
        <div className="delivery-issues-table-wrap"><table className="delivery-issues-table">
          <thead><tr><th>Estado</th><th>Aluno / turma</th><th>Destinatário</th><th>Motivo reportado</th><th>Tentativa</th></tr></thead>
          <tbody>{filteredIssues.map((issue) => <tr key={issue.id}>
            <td><span className={`delivery-status-badge ${issue.status.toLowerCase()}`}>{statusLabels[issue.status]}</span></td>
            <td><strong>{issue.studentName}</strong><small>{issue.turmaName}</small></td>
            <td><strong>{issue.recipientName || "Encarregado"}</strong><small>{issue.recipientEmail}</small></td>
            <td className="delivery-issue-reason">{issue.error || "O serviço de e-mail não forneceu detalhes adicionais."}</td>
            <td>{new Date(issue.attemptedAt).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" })}</td>
          </tr>)}</tbody>
        </table></div>
      )}

      <p className="delivery-issues-note">Os eventos de devolução e atraso são recebidos através do webhook do Resend. Configure o endpoint <strong>/api/webhooks/resend</strong> e a variável <strong>RESEND_WEBHOOK_SECRET</strong> no serviço de e-mail.</p>
      <style>{`
        .delivery-issues-page { display:grid; gap:1.2rem; }
        .delivery-issues-topline { display:flex; justify-content:space-between; align-items:center; color:#64748b; font-size:.72rem; font-weight:800; letter-spacing:.08em; }
        .delivery-issues-topline a { color:#1d4ed8; text-decoration:none; letter-spacing:normal; font-size:.82rem; }
        .delivery-issues-heading h2 { margin:.2rem 0 .4rem; color:#173044; font-size:1.65rem; }
        .delivery-issues-heading p:not(.eyebrow) { margin:0; color:#64748b; font-size:.9rem; }
        .delivery-issues-filters { display:flex; gap:.8rem; flex-wrap:wrap; }
        .delivery-issues-filters label { display:grid; gap:.4rem; min-width:220px; color:#334155; font-size:.8rem; font-weight:800; }
        .delivery-issues-filters select { min-width:240px; padding:.7rem .8rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#1e293b; }
        .delivery-issue-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.8rem; }
        .delivery-issue-metrics article { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.1rem; border-radius:12px; border:1px solid #e2e8f0; background:#fff; }
        .delivery-issue-metrics span { color:#475569; font-size:.83rem; font-weight:700; }
        .delivery-issue-metrics strong { font-size:1.35rem; color:#173044; }
        .delivery-issue-metrics .metric-bounced { background:#fff1f2; border-color:#fecdd3; }
        .delivery-issue-metrics .metric-failed { background:#fff7ed; border-color:#fed7aa; }
        .delivery-issue-metrics .metric-delayed { background:#fffbeb; border-color:#fde68a; }
        .delivery-issues-table-wrap { overflow:auto; border:1px solid #e2e8f0; border-radius:14px; background:#fff; }
        .delivery-issues-table { width:100%; border-collapse:collapse; text-align:left; font-size:.82rem; }
        .delivery-issues-table th,.delivery-issues-table td { padding:.8rem .75rem; border-bottom:1px solid #e2e8f0; vertical-align:top; }
        .delivery-issues-table thead th { color:#64748b; background:#f8fafc; font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
        .delivery-issues-table td strong,.delivery-issues-table td small { display:block; }
        .delivery-issues-table td small { margin-top:.22rem; color:#64748b; font-size:.76rem; }
        .delivery-status-badge { display:inline-block; padding:.3rem .5rem; border-radius:999px; font-size:.69rem; font-weight:800; white-space:nowrap; }
        .delivery-status-badge.bounced { color:#9f1239; background:#ffe4e6; }
        .delivery-status-badge.failed { color:#9a3412; background:#ffedd5; }
        .delivery-status-badge.delayed { color:#854d0e; background:#fef3c7; }
        .delivery-issue-reason { min-width:220px; max-width:400px; color:#334155; overflow-wrap:anywhere; }
        .delivery-issues-empty { display:grid; gap:.35rem; padding:1.5rem; border:1px solid #bbf7d0; border-radius:14px; background:#f0fdf4; color:#166534; }
        .delivery-issues-empty span,.delivery-issues-feedback { color:#64748b; font-size:.86rem; }
        .delivery-issues-feedback.error { color:#b91c1c; }
        .delivery-issues-note { margin:0; padding:.9rem 1rem; border-radius:10px; background:#f1f5f9; color:#64748b; font-size:.78rem; line-height:1.55; }
        @media (max-width:700px) { .delivery-issue-metrics { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
