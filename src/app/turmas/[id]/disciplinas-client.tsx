"use client";

import { useState } from "react";

export function TurmaDisciplinasClient({
  turmaId,
  initialSubjects,
  isAdmin,
}: {
  turmaId: string;
  initialSubjects: string[];
  isAdmin: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [newSubject, setNewSubject] = useState("");
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  if (!isAdmin) {
    return null;
  }

  async function refreshSubjects() {
    const response = await fetch(`/api/turmas/${turmaId}/subjects`);
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
  }

  async function handleAddSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newSubject.trim();

    if (!value) {
      setStatus("error");
      setMessage("Digite o nome da disciplina.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/turmas/${turmaId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar a disciplina.");
      }

      setNewSubject("");
      setStatus("success");
      setMessage("Disciplina criada com sucesso.");
      await refreshSubjects();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function handleRemoveSubject(subjectName: string) {
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/turmas/${turmaId}/subjects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subjectName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível remover a disciplina.");
      }

      setStatus("success");
      setMessage("Disciplina removida.");
      await refreshSubjects();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function handleEditSubject(subjectName: string) {
    const value = draftSubject.trim();

    if (!value) {
      setStatus("error");
      setMessage("Digite o novo nome da disciplina.");
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/turmas/${turmaId}/subjects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: subjectName, newName: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível editar a disciplina.");
      }

      setEditingSubject(null);
      setDraftSubject("");
      setStatus("success");
      setMessage("Disciplina atualizada.");
      await refreshSubjects();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  return (
    <>
      <button type="button" className="disciplinas-button" onClick={() => setIsOpen(true)}>
        Disciplinas
      </button>

      {isOpen && (
        <div className="disciplinas-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="disciplinas-modal" onClick={(event) => event.stopPropagation()}>
            <div className="disciplinas-modal-header">
              <h3>Disciplinas</h3>
              <button type="button" className="disciplinas-modal-close" onClick={() => setIsOpen(false)} aria-label="Fechar">
                ×
              </button>
            </div>

            <div className="disciplinas-modal-body">
              <form onSubmit={handleAddSubject} className="disciplinas-add-row">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(event) => setNewSubject(event.target.value)}
                  placeholder="Adicionar disciplina"
                />
                <button type="submit" disabled={status === "saving"}>Adicionar</button>
              </form>

              <div className="disciplinas-list">
                {subjects.length === 0 ? (
                  <p className="disciplinas-empty">Nenhuma disciplina registada.</p>
                ) : (
                  subjects.map((subject) => (
                    <div key={subject} className="disciplina-item">
                      {editingSubject === subject ? (
                        <>
                          <input
                            type="text"
                            value={draftSubject}
                            onChange={(event) => setDraftSubject(event.target.value)}
                            placeholder="Novo nome"
                          />
                          <div className="disciplina-item-actions">
                            <button type="button" className="disciplina-edit-button" onClick={() => handleEditSubject(subject)}>
                              Guardar
                            </button>
                            <button type="button" className="disciplina-remove-button" onClick={() => setEditingSubject(null)}>
                              Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <strong>{subject}</strong>
                          <div className="disciplina-item-actions">
                            <button
                              type="button"
                              className="disciplina-edit-button"
                              onClick={() => {
                                setEditingSubject(subject);
                                setDraftSubject(subject);
                              }}
                            >
                              Editar
                            </button>
                            <button type="button" className="disciplina-remove-button" onClick={() => handleRemoveSubject(subject)}>
                              Remover
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {message && <p className={`disciplinas-status ${status}`}>{message}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
