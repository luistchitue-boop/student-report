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
}: {
  turmaId: string;
  student: { id: string; name: string; attendance: string; active: boolean };
}) {
  const [isActive, setIsActive] = useState(student.active);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedState, setSelectedState] = useState<boolean>(isActive);

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedState(isActive);
    setShowModal(true);
  };

  const handleCloseModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
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
    try {
      const response = await fetch(
        `/api/turmas/${turmaId}/students/${student.id}/toggle-active`,
        { method: "PATCH" }
      );
      if (response.ok) {
        setIsActive(selectedState);
        setShowModal(false);
      }
    } catch (error) {
      console.error("Failed to toggle student active status:", error);
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
            <span className="student-avatar" aria-hidden="true">
              👤
            </span>
          </div>
          <div className="student-card-body">
            <strong>{getDisplayName(student.name)}</strong>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={isLoading}
            className={`attendance-pill ${isActive ? "present" : "absent"}`}
            title="Click para mudar estado"
          >
            {isActive ? "Activo(a)" : "Inactivo(a)"}
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
                  <span>Activo(a)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="student-state"
                    value="inactive"
                    checked={selectedState === false}
                    onChange={() => setSelectedState(false)}
                  />
                  <span>Inactivo(a)</span>
                </label>
              </div>
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
                {isLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
