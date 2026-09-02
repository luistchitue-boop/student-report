"use client";

import { useState } from "react";

export default function TurmaDeleteAction({ turmaId, turmaName }: { turmaId: string; turmaName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(`Tem a certeza que deseja remover a turma "${turmaName}" e todos os seus dados?`);

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/turmas/${turmaId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível remover a turma.");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="turma-card-delete"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? "A remover..." : "Remover"}
      </button>

      {error && <p className="disciplinas-status error">{error}</p>}
    </>
  );
}
