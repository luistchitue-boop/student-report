"use client";

import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button type="button" variant="outline"><BookOpen /> Disciplinas <Badge variant="secondary" className="ml-1">{subjects.length}</Badge></Button>} />
      <DialogContent className="max-h-[min(85svh,44rem)] overflow-y-auto sm:max-w-xl">
        <DialogCloseButton />
        <DialogHeader>
          <DialogTitle>Disciplinas da turma</DialogTitle>
          <DialogDescription>Adicione, edite ou remova as disciplinas associadas a esta turma.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddSubject} className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Label htmlFor="new-subject" className="sr-only">Nome da nova disciplina</Label>
            <Input id="new-subject" type="text" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} placeholder="Nome da disciplina" maxLength={120} />
          </div>
          <Button type="submit" disabled={status === "saving" || !newSubject.trim()}><Plus /> Adicionar</Button>
        </form>

        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {subjects.length === 0 ? (
            <Card className="border-dashed shadow-none"><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma disciplina registada.</CardContent></Card>
          ) : subjects.map((subject) => (
            <Card key={subject} className="shadow-none">
              <CardContent className="flex min-w-0 flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                {editingSubject === subject ? (
                  <form
                    className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => { event.preventDefault(); void handleEditSubject(subject); }}
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`edit-subject-${subject}`} className="sr-only">Editar {subject}</Label>
                      <Input id={`edit-subject-${subject}`} value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} maxLength={120} autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={status === "saving" || !draftSubject.trim()}>Guardar</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditingSubject(null); setDraftSubject(""); }}>Cancelar</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="size-4" /></span>
                      <span className="truncate text-sm font-medium">{subject}</span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditingSubject(subject); setDraftSubject(subject); }} aria-label={`Editar ${subject}`}><Pencil /> Editar</Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => void handleRemoveSubject(subject)} disabled={status === "saving"} aria-label={`Remover ${subject}`}><Trash2 /> Remover</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {message && <p className={`rounded-lg border p-3 text-sm ${status === "error" ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`} role={status === "error" ? "alert" : "status"}>{message}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
