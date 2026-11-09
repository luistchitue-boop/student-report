"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";

type RankedStudent = {
  id: string;
  name: string;
  avatarUrl: string | null;
  gradeAverage: number | null;
  gradeCount: number;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
};

type MonthlyStatistics = {
  turmaName: string;
  months: string[];
  gradeScale: number;
  studentCount: number;
  assessedStudentCount: number;
  classAverage: number | null;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
  bestGradeStudents: RankedStudent[];
  worstGradeStudents: RankedStudent[];
  fewestAbsenceStudents: RankedStudent[];
  mostAbsenceStudents: RankedStudent[];
};

function getAvailableMonths() {
  const now = new Date();
  const schoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(schoolYear - index))
    .flat()
    .filter((period) => period.start <= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

function StudentRanking({ title, students, emptyText, criterion }: { title: string; students: RankedStudent[]; emptyText: string; criterion: "grades" | "absences" }) {
  return (
    <article className="turma-monthly-ranking">
      <h3>{title}</h3>
      {students.length ? <ol>{students.map((student) => (
        <li key={student.id}>
          {student.avatarUrl ? <Image className="turma-monthly-avatar" src={student.avatarUrl} width={42} height={42} unoptimized alt={`Fotografia de ${student.name}`} /> : <span className="turma-monthly-avatar turma-monthly-avatar-fallback" aria-hidden="true">{student.name.trim().slice(0, 1).toLocaleUpperCase()}</span>}
          <span className="turma-monthly-student-details"><span className="turma-monthly-student-name">{student.name}</span><span className="turma-monthly-student-stats">{criterion === "grades" ? <>{student.gradeAverage?.toFixed(1) ?? "—"} valores <span className="turma-monthly-secondary-stat">({student.absenceCount} falta(s))</span></> : <>{student.absenceCount} falta(s) <span className="turma-monthly-secondary-stat">({student.gradeAverage === null ? "sem média" : `${student.gradeAverage.toFixed(1)} valores`})</span></>}</span></span>
        </li>
      ))}</ol> : <p>{emptyText}</p>}
    </article>
  );
}

export function TurmaMonthlyStatistics({ turmaId }: { turmaId: string }) {
  const months = useMemo(() => getAvailableMonths(), []);
  const [selectedMonths, setSelectedMonths] = useState(() => months[0] ? [months[0].start.toISOString().slice(0, 7)] : []);
  const [statistics, setStatistics] = useState<MonthlyStatistics | null>(null);
  const [classification, setClassification] = useState<"grades" | "absences">("grades");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedMonthsKey = selectedMonths.join(",");

  useEffect(() => {
    if (!selectedMonthsKey) return;
    const monthKeys = selectedMonthsKey.split(",");
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    const query = new URLSearchParams({ turmaId });
    monthKeys.forEach((monthKey) => query.append("month", monthKey));
    fetch(`/api/turmas/monthly-statistics?${query.toString()}`, { cache: "no-store" })
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
  }, [selectedMonthsKey, turmaId]);

  function toggleMonth(monthKey: string) {
    setSelectedMonths((current) => current.includes(monthKey)
      ? current.filter((value) => value !== monthKey)
      : [...current, monthKey].sort());
  }

  const selectedPeriodLabels = months
    .filter((period) => selectedMonths.includes(period.start.toISOString().slice(0, 7)))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(getPeriodLabel);

  return (
    <section className="turma-monthly-statistics" aria-labelledby="turma-monthly-statistics-title">
      <header className="turma-monthly-statistics-header">
        <div>
          <p className="eyebrow">DESEMPENHO DA TURMA</p>
          <h2 id="turma-monthly-statistics-title">Estatísticas mensais</h2>
          <p>Média por aluno avaliado, faltas e classificações da turma.</p>
        </div>
        <fieldset className="turma-monthly-period-picker">
          <legend>Selecionar meses</legend>
          <div>{months.map((period) => {
            const monthKey = period.start.toISOString().slice(0, 7);
            return <label key={period.key}><input type="checkbox" checked={selectedMonths.includes(monthKey)} onChange={() => toggleMonth(monthKey)} />{getPeriodLabel(period)}</label>;
          })}</div>
        </fieldset>
      </header>

      {!selectedMonths.length ? <p className="turma-monthly-message">Selecione pelo menos um mês para ver a classificação.</p> : error ? <p className="turma-monthly-message error" role="alert">{error}</p> : loading || (statistics && statistics.months.join(",") !== selectedMonthsKey) ? <p className="turma-monthly-message">A carregar estatísticas...</p> : statistics ? (
        <>
          <p className="turma-monthly-selected-periods">Período agregado: {selectedPeriodLabels.join(", ")}</p>
          <div className="turma-monthly-metrics">
            <article><span>Média geral</span><strong>{statistics.classAverage?.toFixed(1) ?? "—"}<small> / {statistics.gradeScale}</small></strong><small>{statistics.assessedStudentCount} de {statistics.studentCount} aluno(s) avaliados</small></article>
            <article><span>Total de faltas</span><strong>{statistics.absenceCount}</strong><small>{statistics.unjustifiedAbsenceCount} injustificada(s) · {statistics.justifiedAbsenceCount} justificada(s)</small></article>
          </div>
          <div className="turma-monthly-classification-switch" role="group" aria-label="Critério da classificação">
            <button type="button" className={classification === "grades" ? "active" : ""} aria-pressed={classification === "grades"} onClick={() => setClassification("grades")}>Classificação por notas</button>
            <button type="button" className={classification === "absences" ? "active" : ""} aria-pressed={classification === "absences"} onClick={() => setClassification("absences")}>Classificação por faltas</button>
          </div>
          <p className="turma-monthly-ranking-note">{classification === "grades" ? "Classificação baseada na média de todas as notas semanais registadas nos meses selecionados: melhor média primeiro e pior média primeiro. Alunos sem notas nesses meses não entram nestas listas." : "Classificação baseada no total de faltas dos meses selecionados: menos faltas primeiro e mais faltas primeiro. Inclui todos os alunos ativos; faltas justificadas e injustificadas contam igualmente."}</p>
          <div className="turma-monthly-rankings">
            {classification === "grades" ? <>
              <StudentRanking title="Top 5 · melhores notas" students={statistics.bestGradeStudents} emptyText="Ainda não há alunos avaliados nos meses selecionados." criterion="grades" />
              <StudentRanking title="Bottom 5 · piores notas" students={statistics.worstGradeStudents} emptyText="Ainda não há alunos avaliados nos meses selecionados." criterion="grades" />
            </> : <>
              <StudentRanking title="Top 5 · menos faltas" students={statistics.fewestAbsenceStudents} emptyText="Não há alunos ativos nesta turma." criterion="absences" />
              <StudentRanking title="Bottom 5 · mais faltas" students={statistics.mostAbsenceStudents} emptyText="Não há alunos ativos nesta turma." criterion="absences" />
            </>}
          </div>
        </>
      ) : <p className="turma-monthly-message">Sem dados disponíveis para os meses selecionados.</p>}

      <style>{`
        .turma-monthly-statistics { display:grid; gap:1rem; margin:0 0 1.2rem; padding:1.2rem; border:1px solid #dbe3ec; border-radius:16px; background:#fff; box-shadow:0 6px 20px rgba(15,23,42,.035); }
        .turma-monthly-statistics-header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; }
        .turma-monthly-statistics-header h2 { margin:.2rem 0 .3rem; color:#173044; font-size:1.2rem; }
        .turma-monthly-statistics-header p:not(.eyebrow) { margin:0; color:#64748b; font-size:.84rem; }
        .turma-monthly-period-picker { display:grid; gap:.4rem; min-width:220px; margin:0; padding:.6rem .7rem; border:1px solid #cbd5e1; border-radius:9px; color:#334155; font-size:.76rem; }
        .turma-monthly-period-picker legend { padding:0 .2rem; font-weight:800; }
        .turma-monthly-period-picker > div { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.35rem .7rem; max-height:9rem; overflow:auto; }
        .turma-monthly-period-picker label { display:flex; align-items:center; gap:.4rem; font-weight:600; }
        .turma-monthly-period-picker input { accent-color:#176b8b; }
        .turma-monthly-selected-periods { margin:0; color:#475569; font-size:.78rem; font-weight:700; }
        .turma-monthly-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; }
        .turma-monthly-metrics article { display:grid; gap:.3rem; padding:.9rem 1rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; }
        .turma-monthly-metrics article > span { color:#64748b; font-size:.77rem; font-weight:700; }
        .turma-monthly-metrics article > strong { color:#173044; font-size:1.45rem; }
        .turma-monthly-metrics article > strong small,.turma-monthly-metrics article > small { color:#64748b; font-size:.76rem; font-weight:600; }
        .turma-monthly-ranking-note { margin:0; color:#64748b; font-size:.75rem; line-height:1.5; }
        .turma-monthly-classification-switch { display:flex; flex-wrap:wrap; gap:.4rem; }
        .turma-monthly-classification-switch button { padding:.6rem .8rem; border:1px solid #cbd5e1; border-radius:9px; background:#fff; color:#475569; font-size:.78rem; font-weight:800; cursor:pointer; }
        .turma-monthly-classification-switch button.active { border-color:#176b8b; background:#176b8b; color:#fff; }
        .turma-monthly-rankings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.8rem; }
        .turma-monthly-ranking { min-width:0; padding:.9rem; border:1px solid #e2e8f0; border-radius:12px; }
        .turma-monthly-ranking h3 { margin:0 0 .65rem; color:#173044; font-size:.9rem; }
        .turma-monthly-ranking ol { display:grid; gap:.5rem; margin:0; padding-left:1.4rem; }
        .turma-monthly-ranking li { display:flex; align-items:center; gap:.65rem; padding:.35rem 0; color:#176b8b; }
        .turma-monthly-avatar { display:block; flex:0 0 42px; width:42px; height:42px; border:2px solid #dbe3ec; border-radius:50%; object-fit:cover; background:#e2e8f0; }
        .turma-monthly-avatar-fallback { display:grid; place-items:center; color:#176b8b; font-size:.95rem; font-weight:800; }
        .turma-monthly-student-details { min-width:0; }
        .turma-monthly-student-name,.turma-monthly-student-stats { display:block; }
        .turma-monthly-student-name { color:#1e293b; font-size:.82rem; font-weight:800; }
        .turma-monthly-student-stats,.turma-monthly-ranking > p,.turma-monthly-message { color:#64748b; font-size:.75rem; }
        .turma-monthly-secondary-stat { color:#64748b; font-size:.72rem; }
        .turma-monthly-message { margin:0; }
        .turma-monthly-message.error { color:#b91c1c; }
        @media (max-width:700px) { .turma-monthly-statistics-header { flex-direction:column; } .turma-monthly-period-picker { width:100%; } .turma-monthly-metrics,.turma-monthly-rankings { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
