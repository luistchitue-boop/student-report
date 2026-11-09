"use client";

import { useState } from "react";

export default function TurmasActions({ isAdmin }: { isAdmin: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", educationType: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!isAdmin) {
    return null;
  }

  async function handleCreateTurma(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const turmaName = form.name.trim();

    if (!turmaName) {
      setStatus("error");
      setMessage("Digite o nome da turma.");
      return;
    }
    if (form.educationType !== "ENSINO_GERAL" && form.educationType !== "ENSINO_TECNICO") {
      setStatus("error");
      setMessage("Selecione o tipo de ensino da turma.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/turmas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: turmaName, educationType: form.educationType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar a turma.");
      }

      setStatus("success");
      setMessage(`Turma criada com sucesso: ${data.turma.name}`);
      setForm({ name: "", educationType: "" });
      setIsOpen(false);
      window.location.reload();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  return (
    <>
      <button type="button" className="create-turma-button" onClick={() => setIsOpen(true)}>
        Nova turma
      </button>

      {isOpen && (
        <div className="turma-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="turma-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="turma-create-modal-header">
              <h3>Nova turma</h3>
              <button type="button" className="turma-create-modal-close" onClick={() => setIsOpen(false)} aria-label="Fechar">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTurma} className="turma-create-form">
              <div className="turma-create-field">
                <label htmlFor="turma-name">Nome da turma</label>
                <input
                  id="turma-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: 10CEJ"
                />
              </div>

              <div className="turma-create-field">
                <label htmlFor="turma-education-type">Tipo de ensino</label>
                <select id="turma-education-type" required value={form.educationType} onChange={(event) => setForm((current) => ({ ...current, educationType: event.target.value }))}>
                  <option value="">Selecione</option>
                  <option value="ENSINO_GERAL">Ensino geral</option>
                  <option value="ENSINO_TECNICO">Ensino Técnico</option>
                </select>
              </div>

              <div className="turma-create-actions">
                <button type="button" className="turma-create-cancel" onClick={() => setIsOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="turma-create-submit" disabled={status === "saving"}>
                  {status === "saving" ? "A guardar..." : "Criar turma"}
                </button>
              </div>

              {message && <p className={`turma-create-status ${status}`}>{message}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
