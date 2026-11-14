"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Medal, Trophy } from "lucide-react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TurmaRankingEntry = {
  id: string;
  name: string;
  gradeScale: number;
  studentCount: number;
  assessedStudentCount: number;
  average: number;
  absenceCount: number;
};

function getAvailableMonths() {
  const now = new Date();
  const schoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(schoolYear - index))
    .flat()
    .filter((period) => period.start <= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function TopTurmasMonthlyRanking() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [month, setMonth] = useState(() => months[0]?.start.toISOString().slice(0, 7) ?? "");
  const [classes, setClasses] = useState<TurmaRankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    fetch(`/api/turmas/top-monthly-statistics?month=${encodeURIComponent(month)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar a classificação das turmas.");
        return data as { topTurmas?: TurmaRankingEntry[] };
      })
      .then((data) => { if (!cancelled) setClasses(data.topTurmas ?? []); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a classificação das turmas."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b bg-gradient-to-br from-primary/5 via-background to-background sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5 rounded-full"><Trophy /> Desempenho escolar</Badge>
          <div className="space-y-1">
            <CardTitle className="text-lg">Top 4 turmas do mês</CardTitle>
            <CardDescription>Classificação pela média geral; as faltas desempatarão médias iguais.</CardDescription>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:w-56">
          <Label htmlFor="top-turmas-period">Período mensal</Label>
          <Select value={month} onValueChange={(value) => { if (value) setMonth(value); }}>
            <SelectTrigger id="top-turmas-period" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((period) => {
                const value = period.start.toISOString().slice(0, 7);
                return <SelectItem key={period.key} value={value}>{getPeriodLabel(period)}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{error}</div>
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="A carregar classificação">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
          </div>
        ) : !classes.length ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Medal className="size-5" /></span>
            <p className="text-sm font-medium">Sem classificações neste período</p>
            <p className="text-sm text-muted-foreground">Ainda não há turmas com notas registadas.</p>
          </div>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {classes.map((turma, index) => (
              <li key={turma.id}>
                <Link href={`/turmas/${turma.id}`} className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Card className="h-full border-border/70 bg-muted/20 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:bg-background group-hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-4 pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={index === 0 ? "default" : "secondary"} className="rounded-full">#{index + 1}</Badge>
                        <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight">{turma.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{turma.assessedStudentCount}/{turma.studentCount} alunos avaliados</p>
                      </div>
                      <div className="mt-auto grid grid-cols-2 gap-2 border-t pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Média</p>
                          <p className="font-semibold tabular-nums">{turma.average.toFixed(1)}<span className="text-xs font-normal text-muted-foreground">/{turma.gradeScale}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Faltas</p>
                          <p className="font-semibold tabular-nums">{turma.absenceCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter className="items-start text-xs leading-relaxed text-muted-foreground">
        A média é calculada primeiro por aluno avaliado e depois entre alunos; turmas com escalas diferentes são comparadas proporcionalmente à escala. O total de faltas inclui faltas justificadas e injustificadas de alunos ativos.
      </CardFooter>
    </Card>
  );
}
