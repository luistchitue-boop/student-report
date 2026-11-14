"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TurmaDeliverySummary = {
  id: string;
  name: string;
  studentCount: number;
  sentEmailCount: number;
  deliveredCount: number;
  percentage: number;
  failedCount: number;
  bouncedCount: number;
  delayedCount: number;
};

function getAvailableMonths() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(year - index))
    .flat()
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function DeliveryOverview() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [periodKey, setPeriodKey] = useState(() => months[0]?.key ?? "");
  const [summary, setSummary] = useState<TurmaDeliverySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const totals = summary.reduce((result, turma) => ({
    students: result.students + turma.studentCount,
    sentEmails: result.sentEmails + turma.sentEmailCount,
    delivered: result.delivered + turma.deliveredCount,
    issues: result.issues + turma.failedCount + turma.bouncedCount + turma.delayedCount,
  }), { students: 0, sentEmails: 0, delivered: 0, issues: 0 });
  const totalPercentage = totals.students ? Math.round((totals.delivered / totals.students) * 100) : 0;

  useEffect(() => {
    if (!periodKey) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    fetch(`/api/admin/reports/delivery-status?periodKey=${encodeURIComponent(periodKey)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar os envios.");
        return data as { summary?: TurmaDeliverySummary[] };
      })
      .then((data) => { if (!cancelled) setSummary(data.summary ?? []); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível consultar os envios."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodKey]);

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5"><Mail className="size-3.5" /> Acompanhamento de e-mails</Badge>
          <div className="space-y-1">
            <CardTitle className="text-xl" id="delivery-overview-title">Relatórios entregues por turma</CardTitle>
            <CardDescription>Confirmações de entrega de e-mail recebidas pelo Resend.</CardDescription>
          </div>
        </div>
        <Button variant="outline" className="w-full sm:w-fit" render={<Link href="/admin/relatorios/envios" />}>
          Ver falhas e devoluções <ArrowRight />
        </Button>
      </CardHeader>

      <CardContent className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="delivery-month">Período mensal</Label>
          <Select value={periodKey || null} disabled={!months.length} onValueChange={(value) => { if (value) setPeriodKey(value); }}>
            <SelectTrigger id="delivery-month" className="h-10 w-full data-[size=default]:h-10">
              <SelectValue placeholder="Selecione um mês" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {months.map((month) => <SelectItem key={month.key} value={month.key}>{getPeriodLabel(month)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <Card role="alert" className="border-destructive/30 bg-destructive/5 shadow-none">
            <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</CardContent>
          </Card>
        ) : loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
            <Skeleton className="h-48 rounded-xl md:col-span-3" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border/70 shadow-none">
                <CardContent className="grid gap-1 p-4">
                  <CardDescription>E-mails enviados</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{totals.sentEmails}</CardTitle>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="grid gap-1 p-4">
                  <CardDescription>Alunos com entrega confirmada</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{totals.delivered} <span className="text-sm font-normal text-muted-foreground">/ {totals.students} alunos</span></CardTitle>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="grid gap-1 p-4">
                  <CardDescription>Percentagem global</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{totalPercentage}%</CardTitle>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none sm:col-span-2 xl:col-span-1">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="grid gap-1"><CardDescription>Envios com problemas</CardDescription><CardTitle className="text-2xl tabular-nums">{totals.issues}</CardTitle></div>
                  <Badge variant={totals.issues ? "destructive" : "secondary"}>{totals.issues ? "Requer atenção" : "Sem problemas"}</Badge>
                </CardContent>
              </Card>
            </div>

            {!summary.length ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não existem turmas registadas neste período.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <Table className="min-w-[820px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Turma</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">E-mails enviados</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Alunos entregues</TableHead>
                      <TableHead className="min-w-[220px] text-xs uppercase tracking-wide text-muted-foreground">Entrega</TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Problemas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((turma) => {
                      const issues = turma.failedCount + turma.bouncedCount + turma.delayedCount;
                      return (
                        <TableRow key={turma.id}>
                          <TableCell className="font-medium text-foreground">{turma.name}</TableCell>
                          <TableCell className="tabular-nums">{turma.sentEmailCount}</TableCell>
                          <TableCell className="tabular-nums">{turma.deliveredCount} / {turma.studentCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Progress value={turma.percentage} aria-label={`E-mails entregues de ${turma.name}`} />
                              <span className="w-10 text-right text-xs font-semibold tabular-nums">{turma.percentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={issues ? "destructive" : "secondary"}>{issues}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">Um aluno conta como entregue quando pelo menos um e-mail do encarregado recebe confirmação de entrega do Resend. E-mails aceites para envio, mas ainda sem confirmação, não entram nesta contagem. Configure o webhook do Resend para atualizar os estados.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
