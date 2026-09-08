"use client";

import { useState } from "react";

export function GradeScaleClient({ turmaId, initialScale }: { turmaId: string; initialScale: number }) {
  const [scale, setScale] = useState(initialScale === 10 ? 10 : 20);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function saveScale() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch(`/api/turmas/${turmaId}/grade-scale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeScale: scale }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar a escala.");
      setStatus("Escala guardada.");
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar a escala.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="grade-scale-button" onClick={() => { setStatus(""); setOpen(true); }}>
        Escala: 0-{scale}
      </button>
      {status && <span className="grade-scale-status">{status}</span>}
      {open && <div className="grade-scale-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="grade-scale-modal" role="dialog" aria-modal="true" aria-labelledby="grade-scale-title">
          <div className="grade-scale-modal-heading"><div><p className="eyebrow">CONFIGURAÇÃO DA TURMA</p><h2 id="grade-scale-title">Escala de notas</h2></div><button type="button" className="grade-scale-close" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div>
          <p>Escolha a escala usada para inserir notas e gerar relatórios desta turma.</p>
          <label>Escala<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value={10}>0-10</option><option value={20}>0-20</option></select></label>
          <div className="grade-scale-actions"><button type="button" className="new-student-cancel" onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="new-student-submit" onClick={saveScale} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</button></div>
        </div>
      </div>}
    </>
  );
}
