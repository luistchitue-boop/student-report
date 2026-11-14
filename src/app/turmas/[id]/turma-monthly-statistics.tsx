"use client";

import { useEffect, useMemo, useState } from "react";
import { useId } from "react";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";
import { AlertCircle, Award, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
  type LabelProps,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type RankedStudent = {
  id: string;
  name: string;
  avatarUrl: string | null;
  gradeAverage: number | null;
  gradeCount: number;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
};

type MonthlyStatistics = {
  turmaName: string;
  months: string[];
  gradeScale: number;
  studentCount: number;
  assessedStudentCount: number;
  classAverage: number | null;
  absenceCount: number;
  justifiedAbsenceCount: number;
  unjustifiedAbsenceCount: number;
  bestGradeStudents: RankedStudent[];
  worstGradeStudents: RankedStudent[];
  fewestAbsenceStudents: RankedStudent[];
  mostAbsenceStudents: RankedStudent[];
};

function getAvailableMonths() {
  const now = new Date();
  const schoolYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(schoolYear - index))
    .flat()
    .filter((period) => period.start <= now)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

function StudentRanking({ title, students, emptyText, criterion }: { title: string; students: RankedStudent[]; emptyText: string; criterion: "grades" | "absences" }) {
  const chartId = useId().replace(/:/g, "");
  const data = students.map((student) => ({
    ...student,
    rankingValue: criterion === "grades" ? student.gradeAverage : student.absenceCount,
  }));
  const chartConfig = {
    rankingValue: {
      label: criterion === "grades" ? "Média" : "Faltas",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  function renderAvatarLabel(label: LabelProps) {
    const index = label.index;
    const student = typeof index === "number" ? data[index] : undefined;
    if (!student) return null;

    const viewBox = label.viewBox;
    const barX = viewBox && "x" in viewBox && typeof viewBox.x === "number" ? viewBox.x : Number(label.x ?? 0);
    const barWidth = viewBox && "width" in viewBox && typeof viewBox.width === "number" ? viewBox.width : 0;
    const x = barX + barWidth / 2;
    const y = typeof label.y === "number" ? label.y : Number(label.y ?? 0);
    const centerY = Math.max(27, y - 26);
    const clipId = `${chartId}-avatar-${index}`;

    return (
      <g aria-label={`Fotografia de ${student.name}`}>
        <defs>
          <clipPath id={clipId}>
            <circle cx={x} cy={centerY} r={22} />
          </clipPath>
        </defs>
        {student.avatarUrl ? (
          <image
            href={student.avatarUrl}
            x={x - 22}
            y={centerY - 22}
            width={44}
            height={44}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        ) : (
          <text x={x} y={centerY} fill="var(--muted-foreground)" fontSize={14} fontWeight={600} textAnchor="middle" dominantBaseline="central">
            {student.name.trim().slice(0, 1).toLocaleUpperCase()}
          </text>
        )}
      </g>
    );
  }

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Badge variant="secondary">{students.length}</Badge>
      </CardHeader>
      <CardContent>
        {students.length ? (
          <>
          <ChartContainer
            id={`ranking-${chartId}`}
            config={chartConfig}
            className="h-[280px] w-full aspect-auto sm:h-[320px]"
            aria-label={`${title}: gráfico de barras com fotografias dos alunos`}
          >
            <BarChart accessibilityLayer data={data} barCategoryGap={8} barGap={2} margin={{ top: 62, right: 4, left: -18, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                interval={0}
                tick={{ fontSize: 10 }}
                tickFormatter={(value: string) => {
                  const parts = value.trim().split(/\s+/);
                  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.slice(0, 1)}.` : parts[0]?.slice(0, 10) ?? value;
                }}
              />
              <YAxis hide domain={[0, "dataMax"]} />
              <ChartTooltip content={<ChartTooltipContent formatter={(_value, _name, item) => {
                const student = item.payload as RankedStudent;
                return (
                  <div className="grid flex-1 gap-1.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Média</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">{student.gradeAverage?.toFixed(1) ?? "Sem média"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Faltas</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">{student.absenceCount}</span>
                    </div>
                  </div>
                );
              }} />} />
              <Bar dataKey="rankingValue" name={criterion === "grades" ? "Média" : "Faltas"} fill="var(--color-rankingValue)" radius={[4, 4, 0, 0]} maxBarSize={58} minPointSize={1} isAnimationActive={false}>
                <LabelList dataKey="rankingValue" position="top" offset={6} content={renderAvatarLabel} />
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            A altura representa {criterion === "grades" ? "a média" : "o número de faltas"}. Passe sobre a barra para ver ambos os valores.
          </p>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function TurmaMonthlyStatistics({ turmaId }: { turmaId: string }) {
  const months = useMemo(() => getAvailableMonths(), []);
  const [selectedMonths, setSelectedMonths] = useState(() => months[0] ? [months[0].start.toISOString().slice(0, 7)] : []);
  const [statistics, setStatistics] = useState<MonthlyStatistics | null>(null);
  const [classification, setClassification] = useState<"grades" | "absences">("grades");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedMonthsKey = selectedMonths.join(",");

  useEffect(() => {
    if (!selectedMonthsKey) return;
    const monthKeys = selectedMonthsKey.split(",");
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    const query = new URLSearchParams({ turmaId });
    monthKeys.forEach((monthKey) => query.append("month", monthKey));
    fetch(`/api/turmas/monthly-statistics?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar as estatísticas da turma.");
        return data as MonthlyStatistics;
      })
      .then((data) => { if (!cancelled) setStatistics(data); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as estatísticas da turma.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMonthsKey, turmaId]);

  function toggleMonth(monthKey: string) {
    setSelectedMonths((current) => current.includes(monthKey)
      ? current.filter((value) => value !== monthKey)
      : [...current, monthKey].sort());
  }

  const selectedPeriodLabels = months
    .filter((period) => selectedMonths.includes(period.start.toISOString().slice(0, 7)))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(getPeriodLabel);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col gap-5 border-b bg-gradient-to-br from-primary/5 via-background to-background xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5 rounded-full"><Award /> Desempenho da turma</Badge>
          <div className="space-y-1">
            <CardTitle id="turma-monthly-statistics-title" className="text-lg">Estatísticas mensais</CardTitle>
            <CardDescription>Média por aluno avaliado, faltas e classificações da turma.</CardDescription>
          </div>
        </div>
        <fieldset className="grid min-w-0 gap-2 rounded-xl border bg-background/80 p-3 xl:w-[min(100%,28rem)]">
          <legend className="px-1 text-sm font-medium">Selecionar meses</legend>
          <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto pr-1 sm:grid-cols-3">
            {months.map((period) => {
              const monthKey = period.start.toISOString().slice(0, 7);
              const checkboxId = `period-${turmaId}-${period.key}`;
              return (
                <label key={period.key} htmlFor={checkboxId} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Checkbox id={checkboxId} checked={selectedMonths.includes(monthKey)} onCheckedChange={() => toggleMonth(monthKey)} />
                  <span className="truncate">{getPeriodLabel(period)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {!selectedMonths.length ? (
          <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Selecione pelo menos um mês para ver a classificação.</div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>
        ) : loading || (statistics && statistics.months.join(",") !== selectedMonthsKey) ? (
          <div className="grid gap-3 lg:grid-cols-2" aria-label="A carregar estatísticas">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          </div>
        ) : statistics ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Período agregado</p>
              <div className="flex flex-wrap gap-1.5">{selectedPeriodLabels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/70 bg-muted/20 shadow-none">
                <CardContent className="space-y-1 pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Média geral</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">{statistics.classAverage?.toFixed(1) ?? "—"}<span className="text-base font-normal text-muted-foreground"> / {statistics.gradeScale}</span></p>
                  <p className="text-xs text-muted-foreground">{statistics.assessedStudentCount} de {statistics.studentCount} aluno(s) avaliados</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-muted/20 shadow-none">
                <CardContent className="space-y-1 pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Total de faltas</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">{statistics.absenceCount}</p>
                  <p className="text-xs text-muted-foreground">{statistics.unjustifiedAbsenceCount} injustificada(s) · {statistics.justifiedAbsenceCount} justificada(s)</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <ToggleGroup
                variant="outline"
                value={[classification]}
                onValueChange={(value) => { if (value[0] === "grades" || value[0] === "absences") setClassification(value[0]); }}
                aria-label="Critério da classificação"
                className="w-full sm:w-fit"
              >
                <ToggleGroupItem value="grades" className="min-w-0 flex-1 sm:flex-none"><TrendingUp /> Por notas</ToggleGroupItem>
                <ToggleGroupItem value="absences" className="min-w-0 flex-1 sm:flex-none"><TrendingDown /> Por faltas</ToggleGroupItem>
              </ToggleGroup>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {classification === "grades" ? "Classificação baseada na média de todas as notas semanais registadas nos meses selecionados: melhor média primeiro e pior média primeiro. Alunos sem notas nesses meses não entram nestas listas." : "Classificação baseada no total de faltas dos meses selecionados: menos faltas primeiro e mais faltas primeiro. Inclui todos os alunos ativos; faltas justificadas e injustificadas contam igualmente."}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {classification === "grades" ? <>
                <StudentRanking title="Top 5 · melhores notas" students={statistics.bestGradeStudents} emptyText="Ainda não há alunos avaliados nos meses selecionados." criterion="grades" />
                <StudentRanking title="Bottom 5 · piores notas" students={statistics.worstGradeStudents} emptyText="Ainda não há alunos avaliados nos meses selecionados." criterion="grades" />
              </> : <>
                <StudentRanking title="Top 5 · menos faltas" students={statistics.fewestAbsenceStudents} emptyText="Não há alunos ativos nesta turma." criterion="absences" />
                <StudentRanking title="Bottom 5 · mais faltas" students={statistics.mostAbsenceStudents} emptyText="Não há alunos ativos nesta turma." criterion="absences" />
              </>}
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Sem dados disponíveis para os meses selecionados.</p>
        )}
      </CardContent>
    </Card>
  );
}
