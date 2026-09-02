"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Turma = {
  id: string;
  name: string;
  subjects: string[];
  roster: Array<{ id: string; name: string; age: number }>;
};

const tempos = Array.from({ length: 6 }, (_, index) => `${index + 1}º tempo`);
const faultTypes = [
  { value: "FALTA_DE_MATERIAL", label: "Falta de material" },
  { value: "AUSENCIA_NA_SALA", label: "Ausência na sala" },
] as const;

function displayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? name;
}

export function AttendanceBookClient({ turma }: { turma: Turma }) {
  const [date, setDate] = useState("");
  const [subject, setSubject] = useState(turma.subjects[0] ?? "");
  const [tempo, setTempo] = useState("1º tempo");
  const [faultType, setFaultType] = useState<(typeof faultTypes)[number]["value"]>("FALTA_DE_MATERIAL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!date || !subject) {
      setSelectedIds([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/attendance-book?turmaId=${encodeURIComponent(turma.id)}&date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}&tempo=${encodeURIComponent(tempo)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as faltas.");
        return response.json();
      })
      .then((data: { absences?: Array<{ studentId: string; tempo: string; faultType: (typeof faultTypes)[number]["value"] }> }) => {
        if (!cancelled) {
          setSelectedIds((data.absences ?? []).map((absence) => absence.studentId));
          const savedFaultType = data.absences?.[0]?.faultType;
          if (savedFaultType) setFaultType(savedFaultType);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Não foi possível carregar as faltas.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, subject, tempo, turma.id]);

  function toggleStudent(studentId: string) {
    setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  function toggleAll() {
    setSelectedIds((current) => current.length === turma.roster.length ? [] : turma.roster.map((student) => student.id));
  }

  async function saveAttendance() {
    if (!date || !subject) {
      setStatus("Escolha a data e a disciplina antes de guardar.");
      return;
    }

    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/attendance-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id, date, subject, tempo, faultType, studentIds: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar o livro de ponto.");
      setStatus(`${data.saved} falta(s) guardada(s) para ${date}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar o livro de ponto.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="main-content attendance-book-shell">
      <header className="topbar turma-topbar">
        <div>
          <p className="eyebrow">REGISTO DE ASSIDUIDADE</p>
          <h1>Livro de ponto</h1>
          <p className="attendance-book-subtitle">{turma.name}</p>
        </div>
        <Link href={`/turmas/${turma.id}`} className="dashboard-link">← Voltar à turma</Link>
      </header>

      <section className="attendance-book-panel">
        <div className="attendance-book-toolbar">
          <label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Disciplina<select value={subject} onChange={(event) => setSubject(event.target.value)}>{turma.subjects.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
          <label>Tempo<select value={tempo} onChange={(event) => setTempo(event.target.value)}>{tempos.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
          <fieldset className="attendance-fault-switch">
            <legend>Tipo de falta</legend>
            <div>
              {faultTypes.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className={faultType === entry.value ? "active" : ""}
                  onClick={() => setFaultType(entry.value)}
                  aria-pressed={faultType === entry.value}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="attendance-book-heading">
          <div><p className="eyebrow">ALUNOS DA TURMA</p><h2>Marcar faltas</h2></div>
          <button type="button" className="attendance-select-all" onClick={toggleAll}>{selectedIds.length === turma.roster.length ? "Desmarcar todos" : "Selecionar todos"}</button>
        </div>

        <div className="attendance-student-list">
          {turma.roster.map((student) => (
            <label key={student.id} className={`attendance-student-row ${selectedIds.includes(student.id) ? "selected" : ""}`}>
              <input type="checkbox" checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
              <span className="attendance-student-avatar">{displayName(student.name).charAt(0).toUpperCase()}</span>
              <span><strong>{displayName(student.name)}</strong></span>
              <span className="attendance-check">{selectedIds.includes(student.id) ? "Falta" : "Presente"}</span>
            </label>
          ))}
        </div>

        <div className="attendance-book-footer">
          <span>{isLoading ? "A carregar registos..." : `${selectedIds.length} de ${turma.roster.length} alunos selecionados`}</span>
          <button type="button" className="attendance-save-button" onClick={saveAttendance} disabled={isSaving || isLoading}>{isSaving ? "A guardar..." : "Guardar faltas"}</button>
        </div>
        {status ? <p className="attendance-book-status">{status}</p> : null}
      </section>
    </main>
  );
}
