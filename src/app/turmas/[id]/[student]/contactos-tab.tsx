"use client";

import { useId, useState, type FormEvent } from "react";
import { Mail, Pencil, Phone, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Parent = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export function ContactosTab({ parents, turmaId, studentId, canAddParent }: { parents: Parent[]; turmaId: string; studentId: string; canAddParent: boolean }) {
  const fieldId = useId();
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parentList, setParentList] = useState<Parent[]>(parents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddParent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addName.trim() || !addPhone.trim()) {
      setAddError("Nome e telefone são obrigatórios");
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${studentId}/parents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        setAddError(result.message || "Erro ao adicionar encarregado");
        return;
      }

      setParentList((current) => [...current, result as Parent]);
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setShowAddForm(false);
      setSuccess("Encarregado adicionado com sucesso");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to add parent:", err);
      setAddError("Erro ao conectar ao servidor");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditClick = (parent: Parent) => {
    setEditingParentId(parent.id);
    setEditName(parent.name);
    setEditPhone(parent.phone);
    setEditEmail(parent.email);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingParentId(null);
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      setError("Nome e telefone são obrigatórios");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/parents/${editingParentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
        }),
      });

      if (response.ok) {
        const updatedParent = await response.json();
        setParentList(
          parentList.map((p) => (p.id === editingParentId ? updatedParent : p))
        );
        setSuccess("Dados guardados com sucesso");
        setEditingParentId(null);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Erro ao guardar");
      }
    } catch (err) {
      console.error("Failed to update parent:", err);
      setError("Erro ao conectar ao servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
        Contactos dos encarregados de educação
      </h2>

      {canAddParent && (
        !showAddForm ? (
          <Button type="button" className="min-h-10 w-full sm:w-auto sm:justify-self-start" onClick={() => { setShowAddForm(true); setAddError(null); }}>
            <Plus aria-hidden="true" /> Adicionar encarregado
          </Button>
        ) : (
          <Card className="ring-primary/40">
            <CardHeader>
              <h3 className="font-semibold">Novo encarregado</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddParent} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-add-name`}>Nome *</Label>
                  <Input id={`${fieldId}-add-name`} className="h-10" required value={addName} onChange={(event) => setAddName(event.target.value)} autoComplete="name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-add-phone`}>Telefone *</Label>
                  <Input id={`${fieldId}-add-phone`} className="h-10" required type="tel" value={addPhone} onChange={(event) => setAddPhone(event.target.value)} autoComplete="tel" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-add-email`}>E-mail</Label>
                  <Input id={`${fieldId}-add-email`} className="h-10" type="email" value={addEmail} onChange={(event) => setAddEmail(event.target.value)} autoComplete="email" />
                </div>
                {addError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{addError}</div>}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="min-h-10" disabled={isAdding} onClick={() => { setShowAddForm(false); setAddError(null); }}>Cancelar</Button>
                  <Button type="submit" className="min-h-10" disabled={isAdding}>{isAdding ? "A adicionar..." : "Adicionar"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )
      )}

      {success && (
        <div role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
          {success}
        </div>
      )}

      {parentList.length ? (
        parentList.map((parent) =>
          editingParentId === parent.id ? (
            <Card key={parent.id} className="ring-primary/40">
              <CardHeader>
                <h3 className="font-semibold">Editar Encarregado</h3>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-edit-name`}>Nome *</Label>
                  <Input id={`${fieldId}-edit-name`} className="h-10" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-edit-phone`}>Telefone *</Label>
                  <Input id={`${fieldId}-edit-phone`} className="h-10" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-edit-email`}>E-mail</Label>
                  <Input id={`${fieldId}-edit-email`} className="h-10" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                {error && (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                    {error}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" className="min-h-10" onClick={handleCancelEdit}>Cancelar</Button>
                  <Button type="button" className="min-h-10" onClick={handleSaveEdit} disabled={isLoading}>
                    {isLoading ? "A guardar..." : "Guardar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={parent.id}>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <strong className="block text-base font-semibold text-card-foreground">{parent.name}</strong>
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <a href={`tel:${parent.phone}`} className="break-all font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                        {parent.phone || "Telefone não informado"}
                      </a>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {parent.email ? (
                        <a href={`mailto:${parent.email}`} className="break-all text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                          {parent.email}
                        </a>
                      ) : (
                        <span>E-mail não indicado</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={() => handleEditClick(parent)}>
                  <Pencil aria-hidden="true" /> Editar
                </Button>
              </CardContent>
            </Card>
          )
        )
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum contacto registado.</p>
      )}
    </div>
  );
}
