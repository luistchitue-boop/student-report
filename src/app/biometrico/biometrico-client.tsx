"use client";

import { useState } from "react";

type Period = {
  key: string;
  start: string;
  end: string;
  status: "registado" | "ausente";
  title: string;
  description: string;
  isCurrent: boolean;
  isTest?: boolean;
};

type Turma = { id: string; name: string };

function displayDate(value: string) {
  return new Date(value).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" });
}

export function BiometricoClient({ periods, turmas, selectedTurmaId }: { periods: Period[]; turmas: Turma[]; selectedTurmaId: string }) {
  const [selected, setSelected] = useState<Period | null>(null);
  const [title, setTitle] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function openPeriod(period: Period) {
    if (!period.isCurrent) return;
    setSelected(period);
    setTitle(period.title);
    setDescricao(period.description);
    setStatus("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/biometrico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turmaId: selectedTurmaId, weekStart: selected?.key, title, descricao }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setStatus(data.error ?? "Não foi possível guardar.");
      return;
    }
    setSelected(null);
    window.location.reload();
  }

  return (
    <section className="biometrico-shell workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">REGISTO DE PRESENÇA</p>
          <h3>Períodos de coordenação semanal</h3>
        </div>
      </div>
      <form method="get" className="biometrico-turma-switcher">
        <label htmlFor="biometrico-turma">Turma</label>
        <select id="biometrico-turma" name="turmaId" defaultValue={selectedTurmaId} onChange={(event) => event.currentTarget.form?.submit()}>
          {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
        </select>
      </form>
      <div className="biometrico-list">
        {periods.map((period) => (
          <button key={period.key} className={`biometrico-period ${period.isCurrent ? "current" : ""}`} onClick={() => openPeriod(period)} disabled={!period.isCurrent}>
            <span className="biometrico-period-date">{period.isTest ? "Teste · " : ""}{displayDate(period.start)} - {displayDate(period.end)}</span>
            <strong>{period.status === "registado" ? period.title : "Ausente"}</strong>
            <span className={`biometrico-status ${period.status}`}>{period.status === "registado" ? "Registado" : "Ausente"}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="biometrico-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <form className="biometrico-modal" onSubmit={save}>
            <div className="panel-heading">
              <div><p className="eyebrow">{displayDate(selected.start)} - {displayDate(selected.end)}</p><h3>Registo semanal</h3></div>
              <button type="button" className="biometrico-close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            </div>
            <label className="admin-field"><span>Título</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tema principal da semana" /></label>
            <label className="admin-field"><span>Descrição</span><textarea required value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Descreva o trabalho realizado durante a semana" rows={7} /></label>
            <div className="admin-actions"><button className="admin-submit" disabled={saving}>{saving ? "A guardar..." : "Guardar registo"}</button></div>
            {status && <p className="admin-status error">{status}</p>}
          </form>
        </div>
      )}
    </section>
  );
}