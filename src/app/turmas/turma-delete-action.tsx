"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function TurmaDeleteAction({ turmaId, turmaName }: { turmaId: string; turmaName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  async function handleDelete() {
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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger
          render={<Button type="button" variant="destructive" className="turma-card-delete">Remover</Button>}
        />
        <DialogContent>
          <DialogCloseButton />
          <DialogHeader>
            <DialogTitle>Remover turma?</DialogTitle>
            <DialogDescription>
              A turma “{turmaName}” e todos os dados associados serão removidos. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isDeleting}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "A remover..." : "Remover turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
