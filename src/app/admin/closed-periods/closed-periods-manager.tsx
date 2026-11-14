"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, LockKeyhole, LockOpen, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getMonthlyCoordinationPeriods, getWeeklyCoordinationPeriods, formatPeriodDate, getPeriodLabel } from "@/lib/weekly-coordination";

type ClosedPeriod = {
  id: string;
  weekStart: string;
  weekEnd: string;
  closedAt: string;
  closedBy: { id: string; name: string | null; email: string };
  reason: string | null;
};

type WeeklyPeriodWithStatus = {
  start: Date;
  end: Date;
  key: string;
  isClosed: boolean;
  closedInfo?: ClosedPeriod;
};

type Turma = { id: string; name: string };
type MonthlyClosure = {
  id: string;
  turmaId: string;
  periodStart: string;
  periodEnd: string;
  closedAt: string;
  reason: string | null;
  turma: Turma;
  closedBy: { id: string; name: string | null; email: string };
};

function getAvailableMonthlyPeriods() {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear]
    .flatMap((year) => getMonthlyCoordinationPeriods(year))
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function ClosedPeriodsManager() {
  const [weeklyPeriods, setWeeklyPeriods] = useState<WeeklyPeriodWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [monthlyClosures, setMonthlyClosures] = useState<MonthlyClosure[]>([]);
  const monthlyPeriods = getAvailableMonthlyPeriods();
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthlyPeriods[0]?.key ?? "");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [monthlyCloseReason, setMonthlyCloseReason] = useState("");

  async function loadPeriods(preserveMessage = false) {
    setLoading(true);
    if (!preserveMessage) setMessage("");
    try {
      const response = await fetch("/api/admin/closed-periods");
      if (!response.ok) throw new Error("Não foi possível carregar os períodos.");
      const data = await response.json();
      setTurmas(data.turmas ?? []);
      setMonthlyClosures(data.monthlyClosures ?? []);
      
      const closedPeriodsMap = new Map<string, ClosedPeriod>(
        data.closedPeriods.map((p: ClosedPeriod) => [
          `${formatPeriodDate(new Date(p.weekStart))}|${formatPeriodDate(new Date(p.weekEnd))}`,
          p,
        ])
      );

      const allPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear()).map((period) => {
        const key = `${formatPeriodDate(period.start)}|${formatPeriodDate(period.end)}`;
        const closedInfo = closedPeriodsMap.get(key);
        return {
          ...period,
          isClosed: !!closedInfo,
          closedInfo,
        };
      });

      setWeeklyPeriods(allPeriods);
      setAction("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar períodos.");
      setAction("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadPeriods());
  }, []);

  async function handleTogglePeriod(period: WeeklyPeriodWithStatus) {
    if (period.isClosed) {
      await handleOpenPeriod(period);
    } else {
      setExpandedPeriod(formatPeriodDate(period.start));
      setCloseReason("");
    }
  }

  async function handleClosePeriod(period: WeeklyPeriodWithStatus) {
    setAction("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          weekStart: period.start.toISOString(),
          weekEnd: period.end.toISOString(),
          reason: closeReason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível fechar o período.");
      }

      setAction("success");
      setMessage(`Período de ${formatPeriodDate(period.start)} fechado com sucesso.`);
      setExpandedPeriod(null);
      setCloseReason("");
      void loadPeriods(true);
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function handleOpenPeriod(period: WeeklyPeriodWithStatus) {
    setAction("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          weekStart: period.start.toISOString(),
          weekEnd: period.end.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível reabrir o período.");
      }

      setAction("success");
      setMessage(`Período de ${formatPeriodDate(period.start)} reaberto com sucesso.`);
      void loadPeriods(true);
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function toggleMonthlyClosure(closure?: MonthlyClosure) {
    const turmaId = closure?.turmaId ?? selectedTurmaId;
    const periodKey = closure
      ? `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}`
      : selectedMonthKey;
    if (!turmaId || !periodKey) return;
    setAction("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: closure ? "openTurmaMonth" : "closeTurmaMonth",
          turmaId,
          periodKey,
          reason: closure ? undefined : monthlyCloseReason || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o fecho mensal.");
      const month = monthlyPeriods.find((period) => period.key === periodKey);
      const turmaName = turmas.find((turma) => turma.id === turmaId)?.name ?? closure?.turma.name ?? "turma";
      setAction("success");
      setMessage(closure ? `Período mensal reaberto para ${turmaName}.` : `Período mensal fechado para ${turmaName}.`);
      setMonthlyCloseReason("");
      await loadPeriods(true);
      if (!month) setSelectedMonthKey(periodKey);
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6" role="status" aria-label="A carregar períodos">
        <Card>
          <CardHeader className="gap-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
          </CardContent>
        </Card>
        <Card><CardHeader><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-full max-w-2xl" /></CardHeader><CardContent><Skeleton className="h-28 w-full" /></CardContent></Card>
      </div>
    );
  }

  const today = new Date();
  const closedCount = weeklyPeriods.filter((period) => period.isClosed).length;
  const openCount = weeklyPeriods.length - closedCount;
  const selectedMonthlyClosures = monthlyClosures.filter((closure) =>
    `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}` === selectedMonthKey
  );
  const selectedMonthIsClosed = selectedMonthlyClosures.some((closure) => closure.turmaId === selectedTurmaId);

  return (
    <div className="grid gap-6">
      {message && (
        <Card className={action === "error" ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"} role={action === "error" ? "alert" : "status"}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className={action === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{message}</p>
            {action === "error" && <Button variant="outline" size="sm" onClick={() => void loadPeriods()}><RotateCcw /> Tentar novamente</Button>}
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 border-primary/20 bg-gradient-to-br from-muted/70 via-muted/40 to-card py-0 shadow-sm">
        <CardHeader className="gap-4 border-b bg-transparent py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <Badge variant="outline" className="w-fit gap-1.5"><CalendarDays /> Períodos semanais</Badge>
            <CardTitle className="pt-1 text-xl">Gestão dos períodos semanais</CardTitle>
            <CardDescription>Feche períodos para impedir alterações e reabra-os quando necessário.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="h-7 gap-1.5 px-2.5"><Clock3 /> {openCount} abertos</Badge>
            <Badge variant="destructive" className="h-7 gap-1.5 px-2.5"><ShieldCheck /> {closedCount} fechados</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 pt-3 pb-3">
          {weeklyPeriods.length ? weeklyPeriods.map((period) => {
            const startStr = formatPeriodDate(period.start);
            const endStr = formatPeriodDate(period.end);
            const isExpanded = expandedPeriod === startStr;
            const isPast = period.end < today;
            const closedBy = period.closedInfo?.closedBy.name || period.closedInfo?.closedBy.email;

            return (
              <Card key={startStr} className="gap-0 overflow-hidden py-0 shadow-none">
                <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${period.isClosed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`} aria-hidden="true">
                      {period.isClosed ? <LockKeyhole className="size-4" /> : <CalendarDays className="size-4" />}
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <p className="font-medium">{startStr} até {endStr}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={period.isClosed ? "destructive" : isPast ? "outline" : "secondary"}>
                          {period.isClosed ? "Fechado" : isPast ? "Passado · aberto" : "Aberto"}
                        </Badge>
                        {closedBy && <span className="text-xs text-muted-foreground">Fechado por {closedBy}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={period.isClosed ? "outline" : "destructive"}
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => void handleTogglePeriod(period)}
                    disabled={action === "saving"}
                  >
                    {action === "saving" ? <Spinner /> : period.isClosed ? <LockOpen /> : <LockKeyhole />}
                    {period.isClosed ? "Reabrir período" : "Fechar período"}
                  </Button>
                </CardContent>

                {isExpanded && !period.isClosed && (
                  <div className="grid gap-2 border-t bg-muted/30 p-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`weekly-close-reason-${startStr}`}>Motivo do encerramento <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                      <Textarea
                        id={`weekly-close-reason-${startStr}`}
                        value={closeReason}
                        onChange={(event) => setCloseReason(event.target.value)}
                        placeholder="Ex.: Fim do período letivo"
                        rows={3}
                      />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="outline" onClick={() => { setExpandedPeriod(null); setCloseReason(""); }} disabled={action === "saving"}>
                        Cancelar
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => void handleClosePeriod(period)} disabled={action === "saving"}>
                        {action === "saving" && <Spinner />}
                        Confirmar encerramento
                      </Button>
                    </div>
                  </div>
                )}

                {period.isClosed && period.closedInfo?.reason && (
                  <CardContent className="border-t bg-muted/20 pt-3 pb-4">
                    <p className="break-words text-sm text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {period.closedInfo.reason}</p>
                  </CardContent>
                )}
              </Card>
            );
          }) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Não existem períodos semanais para apresentar.</p>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 border-primary/20 bg-gradient-to-br from-muted/70 via-muted/40 to-card py-0 shadow-sm">
        <CardHeader className="gap-3 border-b bg-transparent py-4">
          <Badge variant="outline" className="w-fit gap-1.5"><CalendarDays /> Gestão mensal</Badge>
          <CardTitle className="text-xl">Fecho mensal por turma</CardTitle>
          <CardDescription>Quando fecha um mês, os professores deixam de poder alterar faltas, justificações, notas, observações ou relatórios semanais dos períodos inteiramente incluídos nesse mês.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 pb-5">
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="grid gap-2">
              <Label htmlFor="closed-period-month">Mês</Label>
              <Select value={selectedMonthKey || null} onValueChange={(value) => setSelectedMonthKey(value ?? "")}>
                <SelectTrigger id="closed-period-month" className="h-10 w-full"><SelectValue placeholder="Selecione um mês" /></SelectTrigger>
                <SelectContent>
                  {monthlyPeriods.map((period) => <SelectItem key={period.key} value={period.key}>{getPeriodLabel(period)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="closed-period-turma">Turma</Label>
              <Select value={selectedTurmaId || null} onValueChange={(value) => setSelectedTurmaId(value ?? "")}>
                <SelectTrigger id="closed-period-turma" className="h-10 w-full"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                <SelectContent>
                  {turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="h-10 sm:col-span-2 lg:col-span-1"
              onClick={() => void toggleMonthlyClosure()}
              disabled={action === "saving" || !selectedTurmaId || !selectedMonthKey || selectedMonthIsClosed}
            >
              {action === "saving" ? <Spinner /> : <LockKeyhole />}
              Fechar mês para turma
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="monthly-close-reason">Motivo do fecho <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Textarea
              id="monthly-close-reason"
              value={monthlyCloseReason}
              onChange={(event) => setMonthlyCloseReason(event.target.value)}
              placeholder="Ex.: Relatórios mensais enviados"
              rows={2}
            />
          </div>

          <div className="grid gap-3 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Turmas fechadas no mês selecionado</h3>
              <Badge variant="secondary">{selectedMonthlyClosures.length} turma(s)</Badge>
            </div>
            {selectedMonthlyClosures.length ? (
              <div className="grid gap-2">
                {selectedMonthlyClosures.map((closure) => (
                  <Card key={closure.id} className="gap-0 border-destructive/20 bg-destructive/[0.03] py-0 shadow-none">
                    <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true"><LockKeyhole className="size-4" /></span>
                        <div className="grid min-w-0 gap-1">
                          <p className="font-medium">{closure.turma.name}</p>
                          <p className="break-words text-xs text-muted-foreground">
                            Fechado por {closure.closedBy.name || closure.closedBy.email}{closure.reason ? ` · ${closure.reason}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => void toggleMonthlyClosure(closure)} disabled={action === "saving"}>
                        {action === "saving" ? <Spinner /> : <LockOpen />} Reabrir turma
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Ainda não há turmas fechadas para este mês.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
