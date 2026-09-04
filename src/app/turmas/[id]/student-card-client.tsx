"use client";

import Link from "next/link";
import { useState } from "react";

function getDisplayName(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  return nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : nameParts[0] ?? name;
}

export function StudentCardClient({
  turmaId,
  student,
  isAdmin,
}: {
  turmaId: string;
  student: { id: string; name: string; attendance: string; active: boolean; avatarUrl?: string | null };
  isAdmin: boolean;
}) {
  const [isActive, setIsActive] = useState(student.active);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedState, setSelectedState] = useState<boolean>(isActive);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl ?? "");
  const [avatarLoading, setAvatarLoading] = useState(false);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedState(isActive);
    setError(null);
    setShowModal(true);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}/avatar`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar o avatar.");
      setAvatarUrl(result.avatarUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível guardar o avatar.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);
    setShowModal(false);
  };

  const handleSaveState = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (selectedState === isActive) {
      setShowModal(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const url = `/api/turmas/${turmaId}/students/${student.id}/toggle-active`;
      console.log("Saving student state with URL:", url, "state:", selectedState);
      
      const response = await fetch(url, { method: "PATCH" });
      
      console.log("Response status:", response.status, "ok:", response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Updated student:", data);
        setIsActive(selectedState);
        setShowModal(false);
      } else {
        let errorMessage = "Não foi possível guardar o estado do aluno";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          const text = await response.text();
          console.error("Error response text:", text);
        }
        console.error("Failed response:", response.status, errorMessage);
        setError(errorMessage);
      }
    } catch (error) {
      console.error("Failed to toggle student active status:", error);
      setError("Erro ao conectar ao servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Link
        href={`/turmas/${turmaId}/${encodeURIComponent(student.id)}`}
        className="student-card-link"
      >
        <article className="student-card">
          <div className="student-avatar-wrap">
            {avatarUrl ? <img src={avatarUrl} alt={`Fotografia de ${student.name}`} className="student-avatar-image" /> : <span className="student-avatar" aria-hidden="true">👤</span>}
            {isAdmin && <label className="student-avatar-upload" title="Alterar fotografia" onClick={(event) => event.stopPropagation()}>
              <span aria-hidden="true">+</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={avatarLoading} />
            </label>}
          </div>
          <div className="student-card-body">
            <strong>{getDisplayName(student.name)}</strong>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={isLoading}
            className={`attendance-pill ${isActive ? "present" : "absent"}`}
            title="Clique para alterar o estado"
          >
            {isActive ? "Ativo" : "Inativo"}
          </button>
        </article>
      </Link>

      {showModal && (
        <div
          className="student-status-modal-backdrop"
          onClick={handleCloseModal}
          role="presentation"
        >
          <div className="student-status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alterar Estado de {getDisplayName(student.name)}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseModal}
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="state-options">
                <label>
                  <input
                    type="radio"
                    name="student-state"
                    value="active"
                    checked={selectedState === true}
                    onChange={() => setSelectedState(true)}
                  />
                  <span>Ativo</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="student-state"
                    value="inactive"
                    checked={selectedState === false}
                    onChange={() => setSelectedState(false)}
                  />
                  <span>Inativo</span>
                </label>
              </div>
              {error && <div className="modal-error">{error}</div>}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-button cancel"
                onClick={handleCloseModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-button save"
                onClick={handleSaveState}
                disabled={isLoading || selectedState === isActive}
              >
                {isLoading ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
