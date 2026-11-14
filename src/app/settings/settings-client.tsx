"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CircleAlert, CircleCheck, KeyRound, Save, UserRound } from "lucide-react";

type User = { id: string; name: string; email: string };

export function SettingsClient() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/user/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o perfil");
        return response.json();
      })
      .then((data: User) => {
        if (!active) return;
        setUser(data);
        setName(data.name || "");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Erro ao carregar o perfil");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() && !newPassword) {
      setError("Altere o nome ou a palavra-passe");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("As palavras-passe não coincidem");
      return;
    }

    if (newPassword && !currentPassword) {
      setError("A palavra-passe atual é obrigatória para alterar a palavra-passe");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar o perfil");
        return;
      }

      setUser(data.user);
      setSuccess("Perfil atualizado com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div role="status" aria-label="A carregar perfil" className="text-primary"><Spinner className="size-8" /></div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
      <header className="border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Conta</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Definições da conta</h1>
          <p className="text-sm text-muted-foreground">Gira os dados do seu perfil e a segurança da sua conta.</p>
        </div>
      </header>

      {error && <p className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}
      {success && <p className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary" role="status"><CircleCheck className="mt-0.5 size-4 shrink-0" />{success}</p>}

      {user && <form onSubmit={handleSave} className="flex flex-col gap-5">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></span>
              <div><CardTitle>Perfil</CardTitle><CardDescription className="mt-1">Atualize o nome apresentado na plataforma.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="grid items-start gap-5 md:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor="settings-email">E-mail</Label>
              <Input id="settings-email" className="h-10 bg-muted/40" value={user.email ?? ""} readOnly aria-describedby="email-help" />
              <p id="email-help" className="text-xs text-muted-foreground">O e-mail de acesso não pode ser alterado.</p>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" className="h-10" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="O seu nome completo" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
              <div><CardTitle>Segurança</CardTitle><CardDescription className="mt-1">Para alterar a palavra-passe, confirme primeiro a atual.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="currentPassword">Palavra-passe atual</Label>
              <Input id="currentPassword" className="h-10" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Introduza a palavra-passe atual" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nova palavra-passe</Label>
              <Input id="newPassword" className="h-10" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirmar palavra-passe</Label>
              <Input id="confirmPassword" className="h-10" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova palavra-passe" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">As alterações aplicam-se à sua conta de acesso.</p>
          <Button type="submit" disabled={isSaving} className="h-10 w-full sm:w-auto">
            <Save /> {isSaving ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </form>}
    </main>
  );
}
