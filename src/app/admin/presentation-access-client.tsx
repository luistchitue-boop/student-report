"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Presentation, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Coordinator = { userId: string; name: string; email: string; enabled: boolean };

export function PresentationAccessClient() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/presentations-access", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os coordenadores.");
        if (!active) return;
        const items: Coordinator[] = result.coordinators ?? [];
        setCoordinators(items);
        setSelectedIds(items.filter((coordinator) => coordinator.enabled).map((coordinator) => coordinator.userId));
      })
      .catch((cause) => {
        if (active) {
          setError(true);
          setMessage(cause instanceof Error ? cause.message : "Não foi possível carregar os acessos.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function toggleCoordinator(userId: string, checked: boolean) {
    setSelectedIds((current) => checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId));
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/admin/presentations-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinatorIds: selectedIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar os acessos.");
      setCoordinators((current) => current.map((coordinator) => ({ ...coordinator, enabled: selectedIds.includes(coordinator.userId) })));
      setMessage(`Acesso às apresentações atualizado para ${selectedIds.length} coordenador(es).`);
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Não foi possível guardar os acessos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <Badge variant="secondary" className="w-fit">RECURSOS DA ESCOLA</Badge>
        <CardTitle className="flex items-center gap-2 text-xl"><Presentation className="size-5 text-primary" /> Acesso a apresentações</CardTitle>
        <CardDescription>Ative a ferramenta apenas para os coordenadores selecionados. As alterações aplicam-se à escola ativa.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:p-6">
        {loading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> A carregar coordenadores…</div> : coordinators.length ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{selectedIds.length} de {coordinators.length} com acesso</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedIds(coordinators.map((coordinator) => coordinator.userId)); setMessage(""); }}>Selecionar todos</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedIds([]); setMessage(""); }}>Desmarcar todos</Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {coordinators.map((coordinator) => {
              const checkboxId = `presentation-access-${coordinator.userId}`;
              return <div key={coordinator.userId} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
                <Checkbox id={checkboxId} checked={selectedIds.includes(coordinator.userId)} onCheckedChange={(checked) => toggleCoordinator(coordinator.userId, checked === true)} />
                <Label htmlFor={checkboxId} className="grid min-w-0 flex-1 cursor-pointer gap-0.5">
                  <span className="truncate text-sm font-medium">{coordinator.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{coordinator.email}</span>
                </Label>
                {selectedIds.includes(coordinator.userId) && <Badge variant="outline">Ativo</Badge>}
              </div>;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{message || "Os coordenadores não selecionados não verão nem poderão abrir a ferramenta."}</p>
            <Button type="button" onClick={save} disabled={saving}><Save /> {saving ? "A guardar…" : "Guardar acessos"}</Button>
          </div>
        </> : <div className="grid gap-3 rounded-lg border border-dashed p-5 text-center">
          <p className="text-sm font-medium">Não há coordenadores nesta escola.</p>
          <p className="text-sm text-muted-foreground">Crie uma conta de coordenador na secção Utilizadores para poder ativar este recurso.</p>
        </div>}
      </CardContent>
    </Card>
  );
}
