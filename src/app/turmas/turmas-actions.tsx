"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger
          render={
            <Button type="button" className="create-turma-button">
              Nova turma
            </Button>
          }
        />
        <DialogContent className="turma-create-modal">
          <DialogCloseButton />
          <DialogHeader className="mb-1">
            <DialogTitle>Nova turma</DialogTitle>
            <DialogDescription>Preencha os dados para adicionar uma turma à escola.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTurma} className="turma-create-form">
            <div className="turma-create-field">
              <Label htmlFor="turma-name">Nome da turma</Label>
              <Input
                id="turma-name"
                type="text"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex.: 10CEJ"
              />
            </div>

            <div className="turma-create-field">
              <Label htmlFor="turma-education-type">Tipo de ensino</Label>
              <Select
                value={form.educationType || null}
                onValueChange={(value) => setForm((current) => ({ ...current, educationType: value ?? "" }))}
              >
                <SelectTrigger id="turma-education-type" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENSINO_GERAL">Ensino geral</SelectItem>
                  <SelectItem value="ENSINO_TECNICO">Ensino Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="turma-create-actions">
              <Button type="button" variant="outline" className="turma-create-cancel" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="turma-create-submit" disabled={status === "saving"}>
                {status === "saving" ? "A guardar..." : "Criar turma"}
              </Button>
            </DialogFooter>

            {message && <p className={`turma-create-status ${status}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
