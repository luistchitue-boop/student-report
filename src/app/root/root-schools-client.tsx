"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type School = { id: string; name: string; isActive: boolean; reportsEnabled: boolean; memberships: { user: { id: string; name: string | null; email: string } }[] };

export function RootSchoolsClient() {
  const [schools, setSchools] = useState<School[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function load() {
    const response = await fetch("/api/root/schools", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as escolas.");
    setSchools(result.schools);
  }

  useEffect(() => {
    Promise.resolve().then(() => load()).catch((reason: unknown) => { setError(true); setMessage(reason instanceof Error ? reason.message : "Erro ao carregar as escolas."); }).finally(() => setLoading(false));
  }, []);

  async function update(payload: Record<string, unknown>, confirmation?: string) {
    if (busy || (confirmation && !window.confirm(confirmation))) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/root/schools", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar a alteração.");
      await load();
      setError(false);
      setMessage("Alteração guardada.");
    } catch (reason) {
      setError(true);
      setMessage(reason instanceof Error ? reason.message : "Não foi possível guardar a alteração.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-muted-foreground">A carregar escolas…</p>;

  return (
    <section className="grid gap-4">
      {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "text-sm text-primary"}>{message}</p>}
      {!schools.length && <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Não existem escolas registadas.</p>}
      {schools.map((school) => (
        <Card key={school.id} className="shadow-sm">
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{school.name}</CardTitle><div className="flex flex-wrap gap-2"><Badge variant={school.isActive ? "secondary" : "destructive"}>{school.isActive ? "Ativa" : "Desativada"}</Badge><Badge variant={school.reportsEnabled ? "secondary" : "destructive"}>{school.reportsEnabled ? "Relatórios ativos" : "Relatórios bloqueados"}</Badge></div></div><CardDescription>As alterações aplicam-se apenas a esta escola.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={school.isActive ? "destructive" : "outline"} disabled={busy} onClick={() => update({ action: "setStatus", schoolId: school.id, isActive: !school.isActive, reportsEnabled: school.reportsEnabled }, `${school.isActive ? "Desativar" : "Ativar"} a escola ${school.name}?`)}>{school.isActive ? "Desativar escola" : "Ativar escola"}</Button>
              <Button variant={school.reportsEnabled ? "destructive" : "outline"} disabled={busy} onClick={() => update({ action: "setStatus", schoolId: school.id, isActive: school.isActive, reportsEnabled: !school.reportsEnabled }, `${school.reportsEnabled ? "Bloquear" : "Ativar"} relatórios de ${school.name}?`)}>{school.reportsEnabled ? "Bloquear relatórios" : "Ativar relatórios"}</Button>
            </div>
            <div className="grid gap-2 border-t pt-4"><h2 className="font-semibold">Administradores</h2>{school.memberships.length ? school.memberships.map(({ user }) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{user.name || "Administrador"}</p><p className="break-all text-xs text-muted-foreground">{user.email}</p></div><Button variant="outline" size="sm" disabled={busy || school.memberships.length <= 1} onClick={() => update({ action: "revokeAdmin", schoolId: school.id, email: user.email }, `Retirar privilégios de administrador de ${user.email} nesta escola?`)}>Remover privilégio</Button></div>) : <p className="text-sm text-muted-foreground">Sem administradores.</p>}</div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="grid gap-2"><Label htmlFor={`root-admin-${school.id}`}>Adicionar administrador existente por e-mail</Label><Input id={`root-admin-${school.id}`} type="email" value={emails[school.id] ?? ""} onChange={(event) => setEmails((current) => ({ ...current, [school.id]: event.target.value }))} placeholder="nome@escola.ao" /></div><Button disabled={busy || !emails[school.id]?.trim()} onClick={() => update({ action: "grantAdmin", schoolId: school.id, email: emails[school.id] }, `Dar privilégios de administrador a ${emails[school.id]} em ${school.name}?`)}>Adicionar administrador</Button></div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
