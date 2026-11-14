"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, ContactRound, Mail, Phone, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StudentSummary = {
  id: string;
  name: string;
  turma: { id: string; name: string } | null;
};

type ParentSummary = {
  id: string;
  name: string;
  phone: string;
  email: string;
  student: StudentSummary | null;
};

export function ParentContactEditor({
  parent,
  linkedParents,
}: {
  parent: ParentSummary;
  linkedParents: ParentSummary[];
}) {
  const [phone, setPhone] = useState(parent.phone);
  const [email, setEmail] = useState(parent.email);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/public/parents/${parent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível enviar a confirmação.");
      }

      setConfirmationSent(true);
      setSuccess(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível enviar a confirmação.");
    } finally {
      setIsSaving(false);
    }
  }

  const students = linkedParents
    .flatMap((linkedParent) => linkedParent.student ? [linkedParent.student] : [])
    .filter((student, index, all) => all.findIndex((item) => item.id === student.id) === index);

  return (
    <main className="public-page public-page-top">
      <Card className="public-card public-card-wide">
        <CardHeader>
          <div className="public-card-icon"><ContactRound className="size-5" /></div>
          <p className="public-overline">Dados do encarregado</p>
          <CardTitle className="text-2xl tracking-tight">{parent.name}</CardTitle>
          <CardDescription>Atualize os contactos partilhados entre os alunos associados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {students.length > 0 ? (
            <>
              <section className="public-associated-students" aria-label="Alunos associados">
                <h2><UsersRound className="size-4" /> Alunos associados</h2>
                <div className="public-student-list">
                  {students.map((student) => (
                    <div className="public-student-item" key={student.id}>
                      <strong>{student.name}</strong>
                      {student.turma && <span>{student.turma.name}</span>}
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="guardian-phone"><Phone className="mr-1 inline size-3.5" /> Telefone</Label>
                  <Input id="guardian-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="912345678" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guardian-email"><Mail className="mr-1 inline size-3.5" /> E-mail</Label>
                  <Input id="guardian-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@exemplo.pt" />
                </div>
              </div>

              {error && <p className="public-feedback error" role="alert">{error}</p>}
              {success && <p className="public-feedback success" role="status"><CheckCircle2 className="size-4" /> Contactos confirmados e guardados com sucesso.</p>}
              {confirmationSent && <p className="public-feedback success" role="status">Foi enviado um e-mail de confirmação. Clique no link recebido para guardar as alterações. Se não o encontrar na caixa de entrada, verifique também o spam.</p>}

              <Button type="button" className="h-11 w-full gap-2 sm:w-auto sm:justify-self-end" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "A enviar confirmação…" : "Guardar contactos"} {!isSaving && <ArrowRight className="size-4" />}
              </Button>
            </>
          ) : (
            <p className="public-feedback">Este perfil não está associado a nenhum aluno ativo.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
