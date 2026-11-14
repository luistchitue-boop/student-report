"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Plus, Save, Trash2, UserRound, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Turma = { id: string; name: string };
type ParentForm = { name: string; phone: string; email: string };

const emptyParent = (): ParentForm => ({ name: "", phone: "", email: "" });

export function NewStudentClient({ turma, canUploadAvatar }: { turma: Turma; canUploadAvatar: boolean }) {
  const [name, setName] = useState("");
  const [parents, setParents] = useState<ParentForm[]>([emptyParent()]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<{ studentId: string; studentName: string; file: File } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); };
  }, [avatarPreview]);

  function selectAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarFile(null);
      setAvatarPreview("");
      setAvatarError("Formato não suportado. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFile(null);
      setAvatarPreview("");
      setAvatarError("A imagem não pode exceder 5 MB.");
      return;
    }
    setAvatarError("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(studentId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/turmas/${encodeURIComponent(turma.id)}/students/${encodeURIComponent(studentId)}/avatar`, { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível guardar a fotografia.");
  }

  async function retryAvatar() {
    if (!pendingAvatar) return;
    setSaving(true);
    setAvatarError("");
    try {
      await uploadAvatar(pendingAvatar.studentId, pendingAvatar.file);
      setPendingAvatar(null);
      setStatus("Fotografia guardada com sucesso.");
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Não foi possível guardar a fotografia.");
    } finally {
      setSaving(false);
    }
  }

  function updateParent(index: number, field: keyof ParentForm, value: string) {
    setParents((current) => current.map((parent, parentIndex) => parentIndex === index ? { ...parent, [field]: value } : parent));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAvatar || avatarError || saving) return;
    setSaving(true);
    setStatus("");
    setAvatarError("");
    try {
      const response = await fetch(`/api/turmas/${turma.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registar o aluno.");
      setName("");
      setParents([emptyParent()]);
      setAvatarFile(null);
      setAvatarPreview("");
      if (avatarFile && canUploadAvatar) {
        try {
          await uploadAvatar(result.student.id, avatarFile);
        } catch (error) {
          setPendingAvatar({ studentId: result.student.id, studentName: result.student.name, file: avatarFile });
          setAvatarError(error instanceof Error ? error.message : "Não foi possível guardar a fotografia.");
          setStatus("Aluno registado com sucesso, mas a fotografia não foi guardada.");
          return;
        }
      }
      setStatus("Aluno registado com sucesso.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível registar o aluno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Registo de aluno</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Novo aluno</h1>
          <p className="text-sm text-muted-foreground">Adicione um aluno e os contactos dos seus encarregados à turma {turma.name}.</p>
        </div>
        <Link href={`/turmas/${turma.id}`} className={buttonVariants({ variant: "outline", size: "lg", className: "w-fit" })}><ArrowLeft /> Voltar à turma</Link>
      </header>

      <form className="flex flex-col gap-5" onSubmit={submit}>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></span>
              <div><CardTitle>Informação pessoal</CardTitle><CardDescription className="mt-1">Dados do aluno a registar.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            {canUploadAvatar && <div className="flex flex-wrap items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="size-20">
                  {avatarFile && avatarPreview && <AvatarImage src={avatarPreview} alt="Pré-visualização da fotografia do aluno" />}
                  <AvatarFallback className="bg-primary/10 text-primary"><UserRound className="size-8" /></AvatarFallback>
                </Avatar>
                <Button type="button" size="icon" className="absolute -right-1 -bottom-1 size-8 rounded-full shadow-sm" disabled={saving || Boolean(pendingAvatar)} onClick={() => cameraInputRef.current?.click()} aria-label="Capturar fotografia do aluno" title="Capturar fotografia"><Camera /></Button>
              </div>
              <div className="grid min-w-0 gap-2">
                <div><p className="text-sm font-semibold">Fotografia do aluno <span className="font-normal text-muted-foreground">(opcional)</span></p><p className="text-xs text-muted-foreground">Tire uma fotografia ou escolha uma imagem JPG, PNG ou WEBP até 5 MB.</p></div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={saving || Boolean(pendingAvatar)} onClick={() => photoInputRef.current?.click()}><ImagePlus /> Escolher imagem</Button>
                  {(avatarFile || (avatarError && !pendingAvatar)) && <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { setAvatarFile(null); setAvatarPreview(""); setAvatarError(""); }}><Trash2 /> Remover</Button>}
                </div>
              </div>
              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden disabled={saving || Boolean(pendingAvatar)} onChange={selectAvatar} />
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={saving || Boolean(pendingAvatar)} onChange={selectAvatar} />
            </div>}
            {avatarError && !pendingAvatar && <p role="alert" className="text-sm text-destructive">{avatarError}</p>}
            <div className="grid gap-2">
              <Label htmlFor="student-name">Nome completo <span aria-hidden="true" className="text-destructive">*</span></Label>
              <Input id="student-name" className="h-10" required disabled={saving} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo do aluno" autoComplete="off" />
            </div>
          </CardContent>
        </Card>

        {parents.map((parent, index) => (
          <Card className="shadow-sm" key={index}>
            <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></span>
                <div><CardTitle>{index === 0 ? "Contacto principal" : "Contacto adicional"}</CardTitle><CardDescription className="mt-1">Encarregado de educação {index + 1}{index === 0 ? " · nome e telefone obrigatórios" : " · opcional; se preenchido, indique nome e telefone"}</CardDescription></div>
              </div>
              {index === 0 ? <Badge variant="secondary" className="w-fit">Principal</Badge> : <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setParents((current) => current.filter((_, parentIndex) => parentIndex !== index))}><Trash2 /> Remover contacto</Button>}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2"><Label htmlFor={`parent-${index}-name`}>Nome {index === 0 && <span aria-hidden="true" className="text-destructive">*</span>}</Label><Input id={`parent-${index}-name`} className="h-10" required={index === 0} disabled={saving} value={parent.name} onChange={(event) => updateParent(index, "name", event.target.value)} placeholder="Nome do encarregado" /></div>
              <div className="grid gap-2"><Label htmlFor={`parent-${index}-phone`}>Telefone {index === 0 && <span aria-hidden="true" className="text-destructive">*</span>}</Label><Input id={`parent-${index}-phone`} className="h-10" required={index === 0} disabled={saving} type="tel" value={parent.phone} onChange={(event) => updateParent(index, "phone", event.target.value)} placeholder="Número de telefone" /></div>
              <div className="grid gap-2"><Label htmlFor={`parent-${index}-email`}>E-mail <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id={`parent-${index}-email`} className="h-10" disabled={saving} type="email" value={parent.email} onChange={(event) => updateParent(index, "email", event.target.value)} placeholder="nome@exemplo.com" /></div>
            </CardContent>
          </Card>
        ))}

        {parents.length < 2 && <Button type="button" variant="outline" className="h-10 w-full sm:w-fit" disabled={saving} onClick={() => setParents((current) => [...current, emptyParent()])}><Plus /> Adicionar outro encarregado</Button>}
        {status && <p role={status.includes("sucesso") ? "status" : "alert"} className={`rounded-lg border px-4 py-3 text-sm ${status.includes("sucesso") ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>{status}</p>}
        {pendingAvatar && <div role="alert" className="grid gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">A fotografia de {pendingAvatar.studentName} não foi guardada. {avatarError}</p>
          <p className="text-muted-foreground">O aluno já foi registado; tente novamente ou adicione a fotografia mais tarde na turma.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => void retryAvatar()}><Camera /> {saving ? "A guardar..." : "Tentar novamente"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => { setPendingAvatar(null); setAvatarError(""); setStatus("Aluno registado com sucesso sem fotografia."); }}>Continuar sem fotografia</Button></div>
        </div>}
        <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <Link href={`/turmas/${turma.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>Cancelar</Link>
          <Button type="submit" size="lg" disabled={saving || Boolean(pendingAvatar) || Boolean(avatarError)}><Save /> {saving ? "A guardar..." : "Registar aluno"}</Button>
        </div>
      </form>
    </main>
  );
}
