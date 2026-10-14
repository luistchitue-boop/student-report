"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";

type TurmaDeliverySummary = {
  id: string;
  name: string;
  studentCount: number;
  deliveredCount: number;
  percentage: number;
  failedCount: number;
  bouncedCount: number;
  delayedCount: number;
};

function getAvailableMonths() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(year - index))
    .flat()
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function DeliveryOverview() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [periodKey, setPeriodKey] = useState(() => months[0]?.key ?? "");
  const [summary, setSummary] = useState<TurmaDeliverySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const totals = summary.reduce((result, turma) => ({
    students: result.students + turma.studentCount,
    delivered: result.delivered + turma.deliveredCount,
    issues: result.issues + turma.failedCount + turma.bouncedCount + turma.delayedCount,
  }), { students: 0, delivered: 0, issues: 0 });
  const totalPercentage = totals.students ? Math.round((totals.delivered / totals.students) * 100) : 0;

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
        return data as { summary?: TurmaDeliverySummary[] };
      })
      .then((data) => { if (!cancelled) setSummary(data.summary ?? []); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível consultar os envios."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodKey]);

  return (
    <section className="delivery-overview" aria-labelledby="delivery-overview-title">
      <header className="delivery-overview-header">
        <div>
          <p className="eyebrow">ACOMPANHAMENTO DE E-MAILS</p>
          <h2 id="delivery-overview-title">Relatórios entregues por turma</h2>
          <p>Percentagem de alunos cujo e-mail foi confirmado como entregue pelo Resend.</p>
        </div>
        <Link href="/admin/relatorios/envios" className="delivery-details-link">Ver falhas e devoluções <span aria-hidden="true">→</span></Link>
      </header>

      <div className="delivery-period-row">
        <label htmlFor="delivery-month">Período mensal</label>
        <select id="delivery-month" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)}>
          {months.map((month) => <option key={month.key} value={month.key}>{getPeriodLabel(month)}</option>)}
        </select>
      </div>

      {error ? <p className="delivery-overview-message error" role="alert">{error}</p> : loading ? <p className="delivery-overview-message">A carregar dados do período...</p> : (
        <>
          <div className="delivery-summary-cards">
            <article><span>Relatórios entregues</span><strong>{totals.delivered} <small>/ {totals.students} alunos</small></strong></article>
            <article><span>Percentagem global</span><strong>{totalPercentage}%</strong></article>
            <article><span>Envios com problemas</span><strong>{totals.issues}</strong></article>
          </div>
          {!summary.length ? <p className="delivery-overview-message">Não existem turmas registadas.</p> : <div className="delivery-summary-table-wrap">
            <table className="delivery-summary-table">
              <thead><tr><th>Turma</th><th>Relatórios entregues</th><th>Percentagem</th><th>Problemas</th></tr></thead>
              <tbody>{summary.map((turma) => {
                const issues = turma.failedCount + turma.bouncedCount + turma.delayedCount;
                return <tr key={turma.id}>
                  <th scope="row">{turma.name}</th>
                  <td>{turma.deliveredCount} / {turma.studentCount}</td>
                  <td><div className="delivery-progress-cell"><div className="delivery-progress" role="progressbar" aria-label={`E-mails entregues de ${turma.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={turma.percentage}><span style={{ width: `${turma.percentage}%` }} /></div><strong>{turma.percentage}%</strong></div></td>
                  <td>{issues ? <span className="delivery-issue-count">{issues}</span> : <span className="delivery-no-issues">—</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
          <p className="delivery-overview-footnote">Um aluno conta como entregue quando pelo menos um e-mail do encarregado recebe confirmação de entrega do Resend. E-mails aceites para envio, mas ainda sem confirmação, não entram nesta contagem. Configure o webhook do Resend para atualizar os estados.</p>
        </>
      )}

      <style>{`
        .delivery-overview { display:grid; gap:1rem; padding:1.3rem; background:#fff; border:1px solid #dbe3ec; border-radius:18px; box-shadow:0 8px 24px rgba(15,23,42,.04); }
        .delivery-overview-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .delivery-overview-header h2 { margin:.2rem 0 .35rem; color:#173044; font-size:1.2rem; }
        .delivery-overview-header p:not(.eyebrow) { margin:0; color:#64748b; font-size:.85rem; }
        .delivery-details-link { display:inline-flex; align-items:center; gap:.4rem; padding:.65rem .85rem; color:#1d4ed8; background:#eff6ff; border-radius:9px; text-decoration:none; font-size:.82rem; font-weight:800; white-space:nowrap; }
        .delivery-period-row { display:flex; align-items:center; gap:.7rem; flex-wrap:wrap; color:#334155; font-size:.85rem; font-weight:700; }
        .delivery-period-row select { min-width:220px; padding:.65rem .75rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#1e293b; }
        .delivery-summary-cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; }
        .delivery-summary-cards article { display:grid; gap:.35rem; padding:.9rem 1rem; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0; }
        .delivery-summary-cards article span { color:#64748b; font-size:.77rem; font-weight:700; }
        .delivery-summary-cards article strong { color:#173044; font-size:1.35rem; }
        .delivery-summary-cards article small { color:#64748b; font-size:.75rem; font-weight:600; }
        .delivery-summary-table-wrap { overflow-x:auto; }
        .delivery-summary-table { width:100%; border-collapse:collapse; font-size:.84rem; text-align:left; }
        .delivery-summary-table th,.delivery-summary-table td { padding:.72rem .6rem; border-bottom:1px solid #e2e8f0; }
        .delivery-summary-table thead th { color:#64748b; font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; }
        .delivery-summary-table tbody th { color:#1e293b; font-weight:800; }
        .delivery-progress-cell { display:flex; align-items:center; gap:.55rem; min-width:150px; }
        .delivery-progress-cell strong { min-width:2.5rem; color:#334155; font-size:.78rem; }
        .delivery-progress { flex:1; height:8px; overflow:hidden; border-radius:99px; background:#e2e8f0; }
        .delivery-progress span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#0f766e,#34d399); }
        .delivery-issue-count { display:inline-flex; min-width:1.6rem; justify-content:center; padding:.2rem .45rem; border-radius:999px; color:#9f1239; background:#fff1f2; font-weight:800; }
        .delivery-no-issues { color:#94a3b8; }
        .delivery-overview-message { margin:0; color:#64748b; font-size:.88rem; }
        .delivery-overview-message.error { color:#b91c1c; }
        .delivery-overview-footnote { margin:0; color:#64748b; font-size:.76rem; line-height:1.5; }
        @media (max-width:700px) { .delivery-overview-header { flex-direction:column; } .delivery-summary-cards { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
