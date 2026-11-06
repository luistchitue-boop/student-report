"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";

type TurmaRankingEntry = {
  id: string;
  name: string;
  gradeScale: number;
  studentCount: number;
  assessedStudentCount: number;
  average: number;
  absenceCount: number;
};

function getAvailableMonths() {
  const now = new Date();
  const schoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(schoolYear - index))
    .flat()
    .filter((period) => period.start <= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function TopTurmasMonthlyRanking() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [month, setMonth] = useState(() => months[0]?.start.toISOString().slice(0, 7) ?? "");
  const [classes, setClasses] = useState<TurmaRankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    fetch(`/api/turmas/top-monthly-statistics?month=${encodeURIComponent(month)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar a classificação das turmas.");
        return data as { topTurmas?: TurmaRankingEntry[] };
      })
      .then((data) => { if (!cancelled) setClasses(data.topTurmas ?? []); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a classificação das turmas."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return (
    <section className="top-turmas-ranking" aria-labelledby="top-turmas-ranking-title">
      <header className="top-turmas-ranking-header">
        <div><p className="eyebrow">DESEMPENHO ESCOLAR</p><h2 id="top-turmas-ranking-title">Top 4 turmas do mês</h2><p>Classificação pela média geral; as faltas desempatarão médias iguais.</p></div>
        <label>Período mensal<select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((period) => <option key={period.key} value={period.start.toISOString().slice(0, 7)}>{getPeriodLabel(period)}</option>)}</select></label>
      </header>
      {error ? <p className="top-turmas-message error" role="alert">{error}</p> : loading ? <p className="top-turmas-message">A carregar classificação...</p> : !classes.length ? <p className="top-turmas-message">Não há turmas com notas registadas neste mês.</p> : (
        <ol className="top-turmas-list">{classes.map((turma, index) => (
          <li key={turma.id}>
            <span className="top-turmas-place">{index + 1}</span>
            <Link href={`/turmas/${turma.id}`} className="top-turmas-class-name">{turma.name}</Link>
            <span className="top-turmas-stat"><strong>{turma.average.toFixed(1)}/{turma.gradeScale}</strong><small>média</small></span>
            <span className="top-turmas-stat"><strong>{turma.absenceCount}</strong><small>faltas</small></span>
            <span className="top-turmas-assessed">{turma.assessedStudentCount}/{turma.studentCount} avaliados</span>
          </li>
        ))}</ol>
      )}
      <p className="top-turmas-footnote">A média é calculada primeiro por aluno avaliado e depois entre alunos; turmas com escalas diferentes são comparadas proporcionalmente à escala. O total de faltas inclui faltas justificadas e injustificadas de alunos ativos.</p>
      <style>{`
        .top-turmas-ranking { display:grid; gap:1rem; margin:0 0 1.2rem; padding:1.2rem; border:1px solid #dbe3ec; border-radius:16px; background:#fff; box-shadow:0 6px 20px rgba(15,23,42,.035); }
        .top-turmas-ranking-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .top-turmas-ranking-header h2 { margin:.2rem 0 .3rem; color:#173044; font-size:1.2rem; }
        .top-turmas-ranking-header p:not(.eyebrow) { margin:0; color:#64748b; font-size:.82rem; }
        .top-turmas-ranking-header label { display:grid; gap:.4rem; min-width:190px; color:#334155; font-size:.76rem; font-weight:800; }
        .top-turmas-ranking-header select { width:100%; min-height:2.6rem; padding:.55rem .7rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#1e293b; }
        .top-turmas-list { display:grid; gap:.55rem; margin:0; padding:0; list-style:none; }
        .top-turmas-list li { display:grid; grid-template-columns:2rem minmax(0,1fr) auto auto auto; align-items:center; gap:.6rem; padding:.75rem; border:1px solid #e2e8f0; border-radius:11px; background:#f8fafc; }
        .top-turmas-place { display:grid; place-items:center; width:1.8rem; height:1.8rem; border-radius:50%; background:#d9edf3; color:#176b8b; font-weight:900; }
        .top-turmas-class-name { min-width:0; color:#173044; font-size:.9rem; font-weight:800; text-decoration:none; }
        .top-turmas-class-name:hover { text-decoration:underline; }
        .top-turmas-stat { display:grid; justify-items:end; gap:.1rem; }
        .top-turmas-stat strong { color:#173044; font-size:.88rem; }
        .top-turmas-stat small,.top-turmas-assessed { color:#64748b; font-size:.7rem; }
        .top-turmas-assessed { text-align:right; }
        .top-turmas-message,.top-turmas-footnote { margin:0; color:#64748b; font-size:.77rem; line-height:1.5; }
        .top-turmas-message.error { color:#b91c1c; }
        @media (max-width:700px) { .top-turmas-ranking-header { flex-direction:column; } .top-turmas-ranking-header label { width:100%; } .top-turmas-list li { grid-template-columns:2rem minmax(0,1fr) auto auto; gap:.45rem; } .top-turmas-assessed { grid-column:2 / -1; text-align:left; } }
      `}</style>
    </section>
  );
}
