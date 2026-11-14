"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Period = {
  key: string;
  start: string;
  end: string;
  status: "registado" | "ausente";
  title: string;
  description: string;
  isCurrent: boolean;
  isClosed: boolean;
  hasActivity: boolean;
  isTest?: boolean;
};

type Turma = { id: string; name: string };

function displayDate(value: string) {
  return new Date(value).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" });
}

export function BiometricoClient({ periods, turmas, selectedTurmaId }: { periods: Period[]; turmas: Turma[]; selectedTurmaId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Period | null>(null);
  const [title, setTitle] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function openPeriod(period: Period) {
    if (period.isClosed || !period.hasActivity || period.start > new Date().toISOString()) return;
    setSelected(period);
    setTitle(period.title);
    setDescricao(period.description);
    setStatus("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/biometrico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: selectedTurmaId, weekStart: selected?.key, title, descricao }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? "Não foi possível guardar.");
        return;
      }
      setSelected(null);
      router.refresh();
    } catch {
      setStatus("Não foi possível guardar. Verifique a ligação e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span>
            <div><CardTitle>Períodos de coordenação semanal</CardTitle><CardDescription className="mt-1">Selecione uma turma e um período para consultar ou registar a coordenação.</CardDescription></div>
          </div>
          <div className="grid w-full gap-2 sm:w-56"><Label htmlFor="biometrico-turma">Turma</Label><Select value={selectedTurmaId || null} disabled={!turmas.length} onValueChange={(value) => { if (value) router.push(`/biometrico?turmaId=${encodeURIComponent(value)}`); }}><SelectTrigger id="biometrico-turma" className="w-full data-[size=default]:h-10"><SelectValue placeholder="Sem turmas atribuídas">{turmas.find((turma) => turma.id === selectedTurmaId)?.name}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}</SelectContent></Select></div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!turmas.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não existem turmas atribuídas para coordenação.</div> : periods.length ? periods.map((period) => {
            const future = new Date(period.start) > new Date();
            const disabled = period.isClosed || !period.hasActivity || future;
            const periodStatus = period.isClosed ? "Fechado" : future ? "Futuro" : !period.hasActivity ? "Sem actividade semanal" : period.status === "registado" ? "Registado" : "Ausente";
            return (
              <Button key={period.key} type="button" variant="outline" className={`h-auto w-full min-w-0 justify-start gap-3 whitespace-normal px-4 py-3 text-left disabled:opacity-70 ${period.isCurrent ? "border-primary/40 bg-primary/5" : ""}`} onClick={() => openPeriod(period)} disabled={disabled}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{period.isTest ? "Teste · " : ""}{displayDate(period.start)} - {displayDate(period.end)}{period.isCurrent ? " · Semana atual" : ""}</span><span className="block break-words text-sm font-semibold">{period.status === "registado" ? period.title : "Ausente"}</span></span>
                <Badge variant={period.status === "registado" && !period.isClosed ? "secondary" : "outline"} className="max-w-[45%] whitespace-normal text-right">{periodStatus}</Badge>
              </Button>
            );
          }) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não existem períodos disponíveis.</div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !saving) setSelected(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Registo semanal</DialogTitle><DialogDescription>{selected && `${displayDate(selected.start)} - ${displayDate(selected.end)}`} · Preencha o relatório de coordenação.</DialogDescription></DialogHeader>
          <DialogCloseButton aria-label="Fechar" disabled={saving} />
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-2"><Label htmlFor="biometrico-title">Título</Label><Input id="biometrico-title" className="h-10" required disabled={saving} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tema principal da semana" /></div>
            <div className="grid gap-2"><Label htmlFor="biometrico-description">Descrição</Label><Textarea id="biometrico-description" required disabled={saving} value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Descreva o trabalho realizado durante a semana" rows={7} /></div>
            {status && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{status}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)}>Cancelar</Button><Button type="submit" disabled={saving}><Save /> {saving ? "A guardar..." : "Guardar registo"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}