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
import { Plus } from "lucide-react";

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
            <Button type="button">
              <Plus /> Nova turma
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogCloseButton />
          <DialogHeader>
            <DialogTitle>Nova turma</DialogTitle>
            <DialogDescription>Preencha os dados para adicionar uma turma à escola.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTurma} className="grid gap-5">
            <div className="grid gap-2">
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

            <div className="grid gap-2">
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" ? "A guardar..." : "Criar turma"}
              </Button>
            </DialogFooter>

            {message && <p className={`rounded-lg border p-3 text-sm ${status === "error" ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`} role={status === "error" ? "alert" : "status"}>{message}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
