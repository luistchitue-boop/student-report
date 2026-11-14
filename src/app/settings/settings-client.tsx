"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, UserRound } from "lucide-react";

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
      <main className="main-content settings-page"><div className="settings-loading">A carregar perfil…</div></main>
    );
  }

  return (
    <main className="main-content settings-page">
      <header className="topbar">
        <div><p className="eyebrow">CONTA</p><h1>Definições da conta</h1></div>
      </header>

      {error && <p className="settings-feedback error" role="alert">{error}</p>}
      {success && <p className="settings-feedback success" role="status">{success}</p>}

      <form onSubmit={handleSave} className="settings-form">
        <Card className="settings-card">
          <CardHeader>
            <div className="settings-card-icon"><UserRound className="size-4" /></div>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Atualize o nome apresentado na plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="settings-email">E-mail</Label>
              <Input id="settings-email" value={user?.email ?? ""} readOnly aria-describedby="email-help" />
              <p id="email-help" className="text-xs text-muted-foreground">O e-mail de acesso não pode ser alterado.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="O seu nome completo" />
            </div>
          </CardContent>
        </Card>

        <Card className="settings-card">
          <CardHeader>
            <div className="settings-card-icon"><KeyRound className="size-4" /></div>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Para alterar a palavra-passe, confirme primeiro a atual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="currentPassword">Palavra-passe atual</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Introduza a palavra-passe atual" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nova palavra-passe</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirmar palavra-passe</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova palavra-passe" />
            </div>
          </CardContent>
        </Card>

        <div className="settings-actions">
          <p className="text-xs text-muted-foreground">As alterações aplicam-se à sua conta de acesso.</p>
          <Button type="submit" disabled={isSaving} className="min-h-10">
            {isSaving ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </form>
    </main>
  );
}
