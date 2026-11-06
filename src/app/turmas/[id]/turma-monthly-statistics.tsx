"use client";

import { useEffect, useMemo, useState } from "react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";

type RankedStudent = {
  id: string;
  name: string;
  gradeAverage: number | null;
  gradeCount: number;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
};

type MonthlyStatistics = {
  turmaName: string;
  month: string;
  gradeScale: number;
  studentCount: number;
  assessedStudentCount: number;
  classAverage: number | null;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
  topStudents: RankedStudent[];
  bottomStudents: RankedStudent[];
};

function getAvailableMonths() {
  const now = new Date();
  const schoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(schoolYear - index))
    .flat()
    .filter((period) => period.start <= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

function StudentRanking({ title, students, emptyText }: { title: string; students: RankedStudent[]; emptyText: string }) {
  return (
    <article className="turma-monthly-ranking">
      <h3>{title}</h3>
      {students.length ? <ol>{students.map((student) => (
        <li key={student.id}>
          <span className="turma-monthly-student-name">{student.name}</span>
          <span className="turma-monthly-student-stats">
            {student.gradeAverage?.toFixed(1) ?? "—"} valores · {student.absenceCount} falta(s)
          </span>
        </li>
      ))}</ol> : <p>{emptyText}</p>}
    </article>
  );
}

export function TurmaMonthlyStatistics({ turmaId }: { turmaId: string }) {
  const months = useMemo(() => getAvailableMonths(), []);
  const [month, setMonth] = useState(() => months[0]?.start.toISOString().slice(0, 7) ?? "");
  const [statistics, setStatistics] = useState<MonthlyStatistics | null>(null);
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
    fetch(`/api/turmas/monthly-statistics?turmaId=${encodeURIComponent(turmaId)}&month=${encodeURIComponent(month)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar as estatísticas da turma.");
        return data as MonthlyStatistics;
      })
      .then((data) => { if (!cancelled) setStatistics(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as estatísticas da turma.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, turmaId]);

  return (
    <section className="turma-monthly-statistics" aria-labelledby="turma-monthly-statistics-title">
      <header className="turma-monthly-statistics-header">
        <div>
          <p className="eyebrow">DESEMPENHO DA TURMA</p>
          <h2 id="turma-monthly-statistics-title">Estatísticas mensais</h2>
          <p>Média por aluno avaliado, faltas e classificações da turma.</p>
        </div>
        <label>Período mensal<select value={month} onChange={(event) => setMonth(event.target.value)}>
          {months.map((period) => <option key={period.key} value={period.start.toISOString().slice(0, 7)}>{getPeriodLabel(period)}</option>)}
        </select></label>
      </header>

      {error ? <p className="turma-monthly-message error" role="alert">{error}</p> : loading || (statistics && statistics.month !== month) ? <p className="turma-monthly-message">A carregar estatísticas...</p> : statistics ? (
        <>
          <div className="turma-monthly-metrics">
            <article><span>Média geral</span><strong>{statistics.classAverage?.toFixed(1) ?? "—"}<small> / {statistics.gradeScale}</small></strong><small>{statistics.assessedStudentCount} de {statistics.studentCount} aluno(s) avaliados</small></article>
            <article><span>Total de faltas</span><strong>{statistics.absenceCount}</strong><small>{statistics.unjustifiedAbsenceCount} injustificada(s) · {statistics.justifiedAbsenceCount} justificada(s)</small></article>
          </div>
          <p className="turma-monthly-ranking-note">Os dados incluem alunos ativos; o total de faltas inclui justificadas e injustificadas. Os melhores são ordenados por menos faltas e, em caso de empate, maior média. Os que precisam de mais apoio são ordenados por mais faltas e, em caso de empate, menor média. Alunos sem notas no mês não entram na classificação.</p>
          <div className="turma-monthly-rankings">
            <StudentRanking title="Top 4 · melhor desempenho" students={statistics.topStudents} emptyText="Ainda não há alunos avaliados neste mês." />
            <StudentRanking title="4 a acompanhar · maior necessidade de apoio" students={statistics.bottomStudents} emptyText="Ainda não há alunos avaliados neste mês." />
          </div>
        </>
      ) : <p className="turma-monthly-message">Sem dados disponíveis para este mês.</p>}

      <style>{`
        .turma-monthly-statistics { display:grid; gap:1rem; margin:0 0 1.2rem; padding:1.2rem; border:1px solid #dbe3ec; border-radius:16px; background:#fff; box-shadow:0 6px 20px rgba(15,23,42,.035); }
        .turma-monthly-statistics-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .turma-monthly-statistics-header h2 { margin:.2rem 0 .3rem; color:#173044; font-size:1.2rem; }
        .turma-monthly-statistics-header p:not(.eyebrow) { margin:0; color:#64748b; font-size:.84rem; }
        .turma-monthly-statistics-header label { display:grid; gap:.4rem; min-width:190px; color:#334155; font-size:.76rem; font-weight:800; }
        .turma-monthly-statistics-header select { width:100%; min-height:2.6rem; padding:.55rem .7rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#1e293b; }
        .turma-monthly-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; }
        .turma-monthly-metrics article { display:grid; gap:.3rem; padding:.9rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
        .turma-monthly-metrics article > span { color:#64748b; font-size:.77rem; font-weight:700; }
        .turma-monthly-metrics article > strong { color:#173044; font-size:1.45rem; }
        .turma-monthly-metrics article > strong small,.turma-monthly-metrics article > small { color:#64748b; font-size:.76rem; font-weight:600; }
        .turma-monthly-ranking-note { margin:0; color:#64748b; font-size:.75rem; line-height:1.5; }
        .turma-monthly-rankings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; }
        .turma-monthly-ranking { min-width:0; padding:.9rem; border:1px solid #e2e8f0; border-radius:12px; }
        .turma-monthly-ranking h3 { margin:0 0 .65rem; color:#173044; font-size:.9rem; }
        .turma-monthly-ranking ol { display:grid; gap:.5rem; margin:0; padding-left:1.4rem; }
        .turma-monthly-ranking li { padding:.35rem 0; color:#176b8b; }
        .turma-monthly-student-name,.turma-monthly-student-stats { display:block; }
        .turma-monthly-student-name { color:#1e293b; font-size:.82rem; font-weight:800; }
        .turma-monthly-student-stats,.turma-monthly-ranking > p,.turma-monthly-message { color:#64748b; font-size:.75rem; }
        .turma-monthly-message { margin:0; }
        .turma-monthly-message.error { color:#b91c1c; }
        @media (max-width:700px) { .turma-monthly-statistics-header { flex-direction:column; } .turma-monthly-statistics-header label { width:100%; } .turma-monthly-metrics,.turma-monthly-rankings { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
