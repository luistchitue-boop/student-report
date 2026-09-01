"use client";

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
      .then((data: { grades?: Array<{ studentId: string; value: number }> }) => {
        if (!cancelled) setGrades(Object.fromEntries((data.grades ?? []).map((grade) => [grade.studentId, String(grade.value)])));
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
              <span className="mini-pauta-student"><strong>{displayName(student.name)}</strong><small>{student.age} anos</small></span>
              <span className="mini-pauta-input-wrap"><span>Nota</span><input type="number" min="0" max="20" step="0.1" value={grades[student.id] ?? ""} onChange={(event) => setGrades((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="-" disabled={!weekStart || !weekEnd} /></span>
            </label>
          ))}
        </div>

        <div className="mini-pauta-footer">
          <span>{isLoading ? "A carregar notas..." : `${Object.values(grades).filter(Boolean).length} de ${turma.roster.length} alunos avaliados`}</span>
          <button type="button" className="mini-pauta-save-button" onClick={saveGrades} disabled={isSaving || isLoading}>{isSaving ? "A guardar..." : "Guardar notas"}</button>
        </div>
        {status ? <p className="mini-pauta-status">{status}</p> : null}
      </section>
    </main>
  );
}
