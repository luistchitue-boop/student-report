"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getDisplayName(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  return nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : nameParts[0] ?? name;
}

export function StudentCardClient({
  turmaId,
  student,
  availableTurmas,
  isAdmin,
}: {
  turmaId: string;
  student: { id: string; name: string; attendance: string; active: boolean; avatarUrl?: string | null };
  availableTurmas: Array<{ id: string; name: string }>;
  isAdmin: boolean;
}) {
  const [isActive, setIsActive] = useState(student.active);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedState, setSelectedState] = useState<boolean>(isActive);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl ?? "");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [destinationTurmaId, setDestinationTurmaId] = useState(availableTurmas[0]?.id ?? "");
  const [isTransferring, setIsTransferring] = useState(false);

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

  const handleDelete = async () => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o aluno "${student.name}" e todos os seus dados?`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível eliminar o aluno.");
      window.location.reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível eliminar o aluno.");
      setIsDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!destinationTurmaId) return;
    if (!window.confirm(`Transferir o aluno "${student.name}" para outra turma?`)) return;

    setIsTransferring(true);
    setError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}/transfer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationTurmaId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível transferir o aluno.");
      window.location.reload();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "Não foi possível transferir o aluno.");
      setIsTransferring(false);
    }
  };

  return (
    <>
      <article className="student-card">
          <div className="student-avatar-wrap">
            <Link href={`/turmas/${turmaId}/${encodeURIComponent(student.id)}`} className="student-card-link" aria-label={`Ver registo de ${student.name}`}>
              {avatarUrl ? <img src={avatarUrl} alt={`Fotografia de ${student.name}`} className="student-avatar-image" /> : <span className="student-avatar" aria-hidden="true">👤</span>}
            </Link>
            {isAdmin && <label className="student-avatar-upload" title="Alterar fotografia" onClick={(event) => event.stopPropagation()}>
              <span aria-hidden="true">+</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={avatarLoading} />
            </label>}
          </div>
          <Link href={`/turmas/${turmaId}/${encodeURIComponent(student.id)}`} className="student-card-link student-card-body">
            <strong>{getDisplayName(student.name)}</strong>
          </Link>
          <Button
            type="button"
            onClick={handleOpenModal}
            disabled={isLoading}
            variant="outline"
            className={`attendance-pill ${isActive ? "present" : "absent"}`}
            title="Clique para alterar o estado"
          >
            {isActive ? "Ativo" : "Inativo"}
          </Button>
      </article>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setError(null); }}>
        <DialogContent className="student-status-modal">
            <DialogCloseButton />
            <DialogHeader>
              <DialogTitle>Alterar estado de {getDisplayName(student.name)}</DialogTitle>
              <DialogDescription>Atualize o estado ou, se necessário, transfira o aluno para outra turma.</DialogDescription>
            </DialogHeader>

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
              {isAdmin && availableTurmas.length > 0 && (
                <div className="student-transfer-field">
                  <Label htmlFor={`transfer-${student.id}`}>Transferir para</Label>
                  <Select
                    value={destinationTurmaId || null}
                    onValueChange={(value) => setDestinationTurmaId(value ?? "")}
                    disabled={isTransferring || isLoading}
                  >
                    <SelectTrigger id={`transfer-${student.id}`} className="w-full">
                      <SelectValue placeholder="Selecionar turma" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTurmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {error && <div className="modal-error" role="alert">{error}</div>}
            </div>

            <DialogFooter className="modal-footer">
              {isAdmin && <Button type="button" variant="destructive" className="modal-button danger" onClick={handleDelete} disabled={isDeleting || isLoading || isTransferring}>
                {isDeleting ? "A eliminar..." : "Eliminar aluno"}
              </Button>}
              <Button
                type="button"
                variant="outline"
                className="modal-button cancel"
                onClick={handleCloseModal}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="modal-button save"
                onClick={handleSaveState}
                disabled={isLoading || isTransferring || selectedState === isActive}
              >
                {isLoading ? "A guardar..." : "Guardar"}
              </Button>
              {isAdmin && availableTurmas.length > 0 && <Button type="button" variant="secondary" className="modal-button transfer" onClick={handleTransfer} disabled={isLoading || isTransferring || !destinationTurmaId}>
                {isTransferring ? "A transferir..." : "Transferir"}
              </Button>}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
