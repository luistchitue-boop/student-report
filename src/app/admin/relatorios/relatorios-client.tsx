"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowDownToLine, Check, ChevronDown, CircleCheck, Eye, Mail, MessageCircle, Search, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPeriodDate, getPeriodLabel, getReportPeriods, isDateInPeriod } from "@/lib/weekly-coordination";
import { DeliveryOverview } from "./delivery-overview";

type Turma = {
  id: string;
  name: string;
  students: number;
  subjects: string[];
  roster: Array<{ id: string; name: string; active: boolean; parents: Array<{ id: string; name: string; email: string; phone: string }> }>;
};

type DeliveryResult = { email: string; studentName: string; success: boolean; error?: string };
type MonthlyDeliverySummary = { id: string; sentEmailCount: number; deliveredCount: number; studentCount: number; percentage: number };
type FailedDelivery = { id: string; studentName: string; recipientName?: string | null; recipientEmail: string; error?: string | null; attemptedAt: string };
type Completeness = { turmaId: string; turmaName: string; subjectCount: number; missingSubjects: string[]; activeStudentCount: number; missingBehaviorStudents: Array<{ id: string; name: string }>; complete: boolean };

export function RelatoriosClient({ turmas, canSend }: { turmas: Turma[]; canSend: boolean }) {
  const reportPeriods = getReportPeriods(new Date().getFullYear());
  const currentPeriod = reportPeriods.find((period) => isDateInPeriod(new Date(), period));
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod?.key ?? "");
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [deliveryResults, setDeliveryResults] = useState<DeliveryResult[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [auditTurmaId, setAuditTurmaId] = useState("");
  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>([]);
  const [auditStatus, setAuditStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [closedPeriods, setClosedPeriods] = useState<Map<string, boolean>>(new Map());
  const [completeness, setCompleteness] = useState<Completeness[]>([]);
  const [completenessPeriodKey, setCompletenessPeriodKey] = useState("");
  const [completenessLoading, setCompletenessLoading] = useState(false);
  const [monthlyDeliverySummary, setMonthlyDeliverySummary] = useState<MonthlyDeliverySummary[]>([]);
  const [deliverySummaryPeriodKey, setDeliverySummaryPeriodKey] = useState("");
  const [deliverySummaryLoading, setDeliverySummaryLoading] = useState(false);
  const [deliverySummaryRefresh, setDeliverySummaryRefresh] = useState(0);
  const turmaIdsKey = turmas.map((turma) => turma.id).join("|");
  const monthlyPeriod = reportPeriods.find((period) => period.key === selectedPeriod)?.type === "MONTHLY";
  const studentsForSelection = turmas.flatMap((turma) => turma.roster.filter((student) => student.active).map((student) => ({ ...student, turmaName: turma.name })));
  const filteredStudents = studentsForSelection.filter((student) => student.name.toLocaleLowerCase().includes(studentSearch.trim().toLocaleLowerCase()));

  useEffect(() => {
    async function loadClosedPeriods() {
      try {
        const response = await fetch("/api/admin/closed-periods");
        if (!response.ok) return;
        const data = await response.json();
        
        const closed = new Map<string, boolean>();
        const closedPeriodList = Array.isArray(data.closedPeriods) ? data.closedPeriods as Array<{ weekStart: string }> : [];
        closedPeriodList.forEach((p) => {
          const start = new Date(p.weekStart).toISOString().slice(0, 10);
          closed.set(start, true);
        });
        setClosedPeriods(closed);
      } catch (error) {
        console.error("Failed to load closed periods:", error);
      }
    }
    loadClosedPeriods();
  }, []);

  function selectStudent(student: (typeof studentsForSelection)[number]) {
    setSelectedStudentId(student.id);
    setSelectedParentIds([]);
    setStudentSearch("");
    setShowStudentSuggestions(false);
    resetFeedback();
  }

  const selectedStudent = studentsForSelection.find((student) => student.id === selectedStudentId);

  function toggleParent(parentId: string) {
    setSelectedParentIds((current) => current.includes(parentId)
      ? current.filter((id) => id !== parentId)
      : [...current, parentId]);
    resetFeedback();
  }

  function isFuturePeriod(periodKey: string) {
    return periodKey > formatPeriodDate(new Date());
  }

  function resetFeedback() {
    setMessage("");
    setStatus("idle");
    setDeliveryResults([]);
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const turmaIds = turmaIdsKey ? turmaIdsKey.split("|") : [];
    if (!selectedPeriod || !turmaIds.length) {
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setCompletenessLoading(true); });
    const query = new URLSearchParams({ periodKey: selectedPeriod });
    turmaIds.forEach((turmaId) => query.append("turmaId", turmaId));
    fetch(`/api/admin/reports/completeness?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível verificar a completude dos dados.");
        return response.json() as Promise<{ completeness?: Completeness[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setCompleteness(data.completeness ?? []);
          setCompletenessPeriodKey(selectedPeriod);
        }
      })
      .catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Não foi possível verificar a completude dos dados."); })
      .finally(() => { if (!cancelled) setCompletenessLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPeriod, turmaIdsKey]);

  useEffect(() => {
    if (!canSend || channel !== "EMAIL" || !monthlyPeriod || !selectedPeriod) return;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setDeliverySummaryLoading(true); });
    fetch(`/api/admin/reports/delivery-status?periodKey=${encodeURIComponent(selectedPeriod)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar os envios do período.");
        return data as { summary?: MonthlyDeliverySummary[] };
      })
      .then((data) => {
        if (!cancelled) {
          setMonthlyDeliverySummary(data.summary ?? []);
          setDeliverySummaryPeriodKey(selectedPeriod);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Não foi possível consultar os envios do período.");
      })
      .finally(() => { if (!cancelled) setDeliverySummaryLoading(false); });
    return () => { cancelled = true; };
  }, [canSend, channel, monthlyPeriod, selectedPeriod, deliverySummaryRefresh]);

  async function handlePreview() {
    if (!selectedPeriod || !selectedStudentId) return;
    setStatus("sending");
    setMessage("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    try {
      const selectedStudentTurma = turmas.find((turma) => turma.roster.some((student) => student.id === selectedStudentId));
      if (!selectedStudentTurma) throw new Error("Não foi possível localizar a turma do aluno.");
      const response = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true, turmaIds: [selectedStudentTurma.id], studentIds: [selectedStudentId], periodKey: selectedPeriod }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar a pré-visualização.");
      }
      setPreviewUrl(URL.createObjectURL(await response.blob()));
      setStatus("success");
      setMessage("Pré-visualização gerada. Nenhuma mensagem foi enviada.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar a pré-visualização.");
    }
  }

  async function handleTurmasPreview() {
    if (!selectedPeriod || !selectedTurmas.length) return;
    setStatus("sending");
    setMessage("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    try {
      const response = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true, turmaIds: selectedTurmas, periodKey: selectedPeriod }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar a pré-visualização.");
      }
      setPreviewUrl(URL.createObjectURL(await response.blob()));
      setStatus("success");
      setMessage("Pré-visualização gerada com os relatórios dos alunos selecionados. Nenhuma mensagem foi enviada.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar a pré-visualização.");
    }
  }

  async function loadFailedDeliveries() {
    if (!selectedPeriod || !auditTurmaId) return;
    setAuditStatus("loading");
    try {
      const response = await fetch(`/api/admin/reports?periodKey=${encodeURIComponent(selectedPeriod)}&turmaId=${encodeURIComponent(auditTurmaId)}&channel=${channel}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar os envios.");
      setFailedDeliveries(data.deliveries ?? []);
      setAuditStatus("loaded");
    } catch (error) {
      setFailedDeliveries([]);
      setAuditStatus("error");
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar os envios.");
    }
  }

  function toggleTurma(turmaId: string) {
    setSelectedTurmas((current) => current.includes(turmaId) ? current.filter((value) => value !== turmaId) : [...current, turmaId]);
    resetFeedback();
  }

  async function handleSendReports(studentId?: string) {
    if (!selectedPeriod) {
      setStatus("error");
      setMessage("Selecione um período antes de enviar.");
      return;
    }

    const selectedStudentTurma = studentId ? turmas.find((turma) => turma.roster.some((student) => student.id === studentId)) : null;
    const turmaIds = studentId ? (selectedStudentTurma ? [selectedStudentTurma.id] : []) : selectedTurmas;
    if (!turmaIds.length) {
      setStatus("error");
      setMessage("Selecione pelo menos uma turma ou um aluno antes de enviar.");
      return;
    }
    setStatus("sending");
    setMessage("");
    setDeliveryResults([]);

    try {
      if (studentId && channel === "EMAIL" && selectedParentIds.length === 0) {
        throw new Error("Selecione pelo menos um encarregado para receber o relatório.");
      }

      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaIds, periodKey: selectedPeriod, channel, ...(studentId ? { studentIds: [studentId] } : {}), ...(studentId && channel === "EMAIL" ? { parentIds: selectedParentIds } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar os relatórios.");

      const skippedNames = (data.skippedStudents ?? []).map((student: { studentName: string }) => student.studentName);
      setStatus(data.failed || skippedNames.length ? "error" : "success");
      const blockedMessage = skippedNames.length ? ` Envio bloqueado sem dados mensais para: ${skippedNames.join(", ")}.` : "";
      setMessage(`${data.sent ?? 0} de ${data.total ?? 0} envio(s) concluído(s) por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}. Taxa de sucesso: ${data.successRate ?? 0}%.${blockedMessage}`);
      setDeliveryResults(data.results ?? []);
      if (channel === "EMAIL" && monthlyPeriod) setDeliverySummaryRefresh((value) => value + 1);
      if (!studentId) setSelectedTurmas([]);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro ao enviar os relatórios.");
    }
  }

  const currentCompleteness = completenessPeriodKey === selectedPeriod ? completeness : [];
  const currentDeliverySummary = deliverySummaryPeriodKey === selectedPeriod ? monthlyDeliverySummary : [];
  const selectedCompleteness = currentCompleteness.filter((item) => selectedTurmas.includes(item.turmaId));
  const completenessReady = selectedCompleteness.length === selectedTurmas.length && selectedTurmas.length > 0;
  const allSelectedTurmasComplete = completenessReady && selectedCompleteness.every((item) => item.complete);

  const selectedStudentLabel = selectedStudent
    ? `${selectedStudent.name} · ${selectedStudent.turmaName}`
    : studentSearch || "Pesquisar aluno...";

  return (
    <section className="space-y-6">
      {canSend && <DeliveryOverview />}

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <Badge variant="secondary" className="w-fit">SELECIONE AS TURMAS</Badge>
          <CardTitle className="text-xl">{canSend ? "Gerar e enviar relatórios" : "Visualizar relatórios e completude"}</CardTitle>
          <CardDescription>{canSend ? "Escolha o canal, o período e as turmas que pretende processar." : "Escolha um período e as turmas para consultar relatórios e completude."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {canSend && (
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="admin-report-channel">Canal de envio</Label>
                <Select value={channel} onValueChange={(value) => {
                  if (value !== "EMAIL" && value !== "WHATSAPP") return;
                  setChannel(value);
                  setFailedDeliveries([]);
                  setAuditStatus("idle");
                  resetFeedback();
                }}>
                  <SelectTrigger id="admin-report-channel" className="h-10 w-full data-[size=default]:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="EMAIL"><span className="flex items-center gap-2"><Mail /> E-mail</span></SelectItem>
                    <SelectItem value="WHATSAPP"><span className="flex items-center gap-2"><MessageCircle /> WhatsApp</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid min-w-0 gap-2">
              <Label htmlFor="admin-report-period">Período de relatório</Label>
              <Select value={selectedPeriod || null} onValueChange={(value) => {
                const nextPeriod = value === "__none__" ? "" : value;
                if (!nextPeriod) {
                  setSelectedPeriod("");
                  setSelectedTurmas([]);
                  setCompleteness([]);
                  setSelectedStudentId("");
                  setSelectedParentIds([]);
                  setStudentSearch("");
                  setFailedDeliveries([]);
                  setAuditStatus("idle");
                  resetFeedback();
                  return;
                }
                setSelectedPeriod(nextPeriod);
                setSelectedTurmas([]);
                setCompleteness([]);
                setSelectedStudentId("");
                setSelectedParentIds([]);
                setStudentSearch("");
                setFailedDeliveries([]);
                setAuditStatus("idle");
                resetFeedback();
              }}>
                <SelectTrigger id="admin-report-period" className="h-10 w-full data-[size=default]:h-10">
                  <SelectValue placeholder="Selecione um período" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="__none__">Selecione um período</SelectItem>
                  {reportPeriods.map((period) => {
                    const isClosed = closedPeriods.has(period.key);
                    const isFuture = isFuturePeriod(period.key);
                    const isDisabled = period.type === "WEEKLY" && (isFuture || isClosed);
                    const label = `${period.type === "WEEKLY" ? "Semanal" : "Mensal"}: ${getPeriodLabel(period)}${isFuture ? " (futuro)" : ""}${period.type === "WEEKLY" && isClosed ? " (fechado)" : ""}`;
                    return <SelectItem key={period.key} value={period.key} disabled={isDisabled}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="font-semibold">Turmas</h2>
                <p className="text-sm text-muted-foreground">Selecione uma ou mais turmas para pré-visualizar ou enviar os relatórios.</p>
              </div>
              <Badge variant={selectedTurmas.length ? "secondary" : "outline"}>{selectedTurmas.length} selecionada(s)</Badge>
            </div>

            {turmas.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {turmas.map((turma) => {
                  const item = currentCompleteness.find((entry) => entry.turmaId === turma.id);
                  const completionDenominator = item ? item.subjectCount + item.activeStudentCount : 0;
                  const completionNumerator = item ? item.subjectCount - item.missingSubjects.length + item.activeStudentCount - item.missingBehaviorStudents.length : 0;
                  const completionPercentage = completionDenominator ? Math.round((completionNumerator / completionDenominator) * 100) : item?.complete ? 100 : 0;
                  const delivery = currentDeliverySummary.find((entry) => entry.id === turma.id);
                  const checkboxId = `report-turma-${turma.id}`;
                  const isSelected = selectedTurmas.includes(turma.id);

                  return (
                    <Card key={turma.id} className={`transition-colors ${isSelected ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border/70"}`}>
                      <CardContent className="flex items-start gap-3 p-4">
                        <Checkbox
                          id={checkboxId}
                          className="mt-0.5"
                          disabled={!selectedPeriod || status === "sending"}
                          checked={isSelected}
                          onCheckedChange={() => toggleTurma(turma.id)}
                        />
                        <div className="min-w-0 flex-1 space-y-3">
                          <Label htmlFor={checkboxId} className="flex cursor-pointer flex-col gap-1">
                            <span className="flex flex-wrap items-center justify-between gap-2 font-semibold text-foreground">{turma.name}{monthlyPeriod && channel === "EMAIL" && delivery ? <Badge variant="secondary" className="gap-1"><Check /> {delivery.sentEmailCount} e-mail(s) enviado(s)</Badge> : null}</span>
                            <span className="text-xs font-normal text-muted-foreground">{turma.students} alunos</span>
                          </Label>
                          {monthlyPeriod && (
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">{completenessLoading && completenessPeriodKey !== selectedPeriod ? "A calcular completude..." : item ? "Completude dos dados" : "A aguardar dados"}</span>
                                {item && <span className="font-semibold tabular-nums">{completionPercentage}%</span>}
                              </div>
                              <Progress value={item ? completionPercentage : 0} aria-label={`Completude dos dados de ${turma.name}`} className="h-1.5" />
                              {channel === "EMAIL" && (deliverySummaryLoading && deliverySummaryPeriodKey !== selectedPeriod
                                ? <p className="text-xs text-muted-foreground">A consultar entregas...</p>
                                : delivery && <p className="text-xs text-muted-foreground">Entrega confirmada: {delivery.deliveredCount}/{delivery.studentCount} alunos</p>)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não existem turmas disponíveis para esta conta.</div>
            )}
          </div>

          {selectedPeriod && selectedTurmas.length > 0 && (
            <Card className="border-border/70 shadow-none">
              <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">Completude dos dados</CardTitle>
                  <CardDescription>Notas por disciplina e comportamento por aluno.</CardDescription>
                </div>
                <Badge variant={!completenessReady ? "outline" : allSelectedTurmasComplete ? "secondary" : "destructive"}>
                  {!completenessReady ? "A verificar" : allSelectedTurmasComplete ? "Pronto para enviar" : "Envio bloqueado"}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3 px-4 pb-4">
                {!completenessReady ? (
                  <p className="text-sm text-muted-foreground">{completenessLoading ? "A verificar os dados das turmas selecionadas..." : "Aguarde a verificação dos dados do período."}</p>
                ) : selectedCompleteness.map((item) => (
                  <Card key={item.turmaId} className="border-border/70 shadow-none">
                    <CardContent className="grid gap-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm font-semibold">{item.turmaName}</strong>
                        <Badge variant={item.complete ? "secondary" : "destructive"}>{item.complete ? <><CircleCheck /> Completo</> : "Incompleto"}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{item.subjectCount - item.missingSubjects.length}/{item.subjectCount} disciplinas</Badge>
                        <Badge variant="outline">{item.activeStudentCount - item.missingBehaviorStudents.length}/{item.activeStudentCount} comportamentos</Badge>
                      </div>
                      {!item.complete && (
                        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                          {item.missingSubjects.length > 0 && <div className="grid content-start gap-1"><span className="text-xs font-medium text-muted-foreground">Disciplinas sem notas</span><p className="text-sm">{item.missingSubjects.join(", ")}</p></div>}
                          {item.missingBehaviorStudents.length > 0 && <div className="grid content-start gap-1"><span className="text-xs font-medium text-muted-foreground">Alunos sem comportamento</span><p className="text-sm">{item.missingBehaviorStudents.map((student) => student.name).join(", ")}</p></div>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={handleTurmasPreview} disabled={status === "sending" || !selectedPeriod || selectedTurmas.length === 0}>
              <Eye /> Pré-visualizar PDF
            </Button>
            {canSend && (
              <Button type="button" onClick={() => handleSendReports()} disabled={status === "sending" || !selectedPeriod || selectedTurmas.length === 0}>
                <Send /> {status === "sending" ? "A enviar..." : `Enviar por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></span>
            <div className="space-y-1">
              <CardTitle className="text-lg">Testar um caso individual</CardTitle>
              <CardDescription>Pré-visualize ou envie o relatório de um aluno específico.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid max-w-lg gap-2">
            <Label htmlFor="admin-student-select">Aluno</Label>
            <Popover open={showStudentSuggestions} onOpenChange={setShowStudentSuggestions}>
              <PopoverTrigger
                render={
                  <Button
                    id="admin-student-select"
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-start gap-2 font-normal"
                    disabled={!selectedPeriod || status === "sending"}
                    aria-expanded={showStudentSuggestions}
                    aria-haspopup="listbox"
                  />
                }
              >
                <Search className="text-muted-foreground" />
                <span className="flex-1 truncate text-left">{selectedStudentLabel}</span>
                <ChevronDown className="text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(90vw,28rem)] space-y-2 p-2">
                <Input
                  id="admin-student-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Pesquisar aluno..."
                  value={studentSearch}
                  onChange={(event) => { setStudentSearch(event.target.value); setSelectedStudentId(""); setSelectedParentIds([]); resetFeedback(); }}
                />
                <div role="listbox" aria-label="Resultados de alunos" className="grid max-h-64 gap-1 overflow-y-auto">
                  {filteredStudents.length ? filteredStudents.slice(0, 12).map((student) => (
                    <Button key={student.id} type="button" variant="ghost" role="option" aria-selected={selectedStudentId === student.id} className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left" onClick={() => selectStudent(student)}>
                      <span className="grid gap-0.5"><span className="font-medium">{student.name}</span><span className="text-xs text-muted-foreground">{student.turmaName}</span></span>
                    </Button>
                  )) : <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {selectedStudent && (
            <Card className="border-border/70 bg-muted/20 shadow-none">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="grid gap-1"><span className="text-sm font-semibold">{selectedStudent.name}</span><span className="text-xs text-muted-foreground">{selectedStudent.turmaName} · {selectedStudent.parents.length} encarregado(s)</span></div>
                <Badge variant="outline">Aluno selecionado</Badge>
              </CardContent>
            </Card>
          )}

          {canSend && channel === "EMAIL" && selectedStudent && (
            <Card className="border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Destinatários do relatório {monthlyPeriod ? "mensal" : "selecionado"}</CardTitle>
                <CardDescription>Selecione um ou mais encarregados. O envio será feito apenas para os contactos escolhidos.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 px-4 pb-4">
                {selectedStudent.parents.length ? selectedStudent.parents.map((parent) => {
                  const parentCheckboxId = `report-parent-${parent.id}`;
                  return (
                    <div key={parent.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox id={parentCheckboxId} className="mt-0.5" disabled={status === "sending"} checked={selectedParentIds.includes(parent.id)} onCheckedChange={() => toggleParent(parent.id)} />
                      <Label htmlFor={parentCheckboxId} className="grid min-w-0 flex-1 cursor-pointer gap-0.5">
                        <span className="font-medium">{parent.name}</span>
                        <span className="break-all text-xs font-normal text-muted-foreground">{parent.email || "Sem e-mail registado"}</span>
                      </Label>
                    </div>
                  );
                }) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Este aluno não tem encarregados registados.</p>}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={status === "sending" || !selectedPeriod || !selectedStudentId}>
              <Eye /> Pré-visualizar PDF
            </Button>
            {canSend && (
              <Button type="button" onClick={() => handleSendReports(selectedStudentId)} disabled={status === "sending" || !selectedPeriod || !selectedStudentId || (channel === "EMAIL" && selectedParentIds.length === 0)}>
                <Send /> {status === "sending" ? "A enviar..." : `Enviar caso individual por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {message && (
        <Card role={status === "error" ? "alert" : "status"} className={status === "error" ? "border-destructive/30 bg-destructive/5 shadow-none" : status === "success" ? "border-primary/30 bg-primary/5 shadow-none" : "bg-muted/30 shadow-none"}>
          <CardContent className={`flex items-start gap-2 p-4 text-sm ${status === "error" ? "text-destructive" : status === "success" ? "text-primary" : "text-muted-foreground"}`}>
            {status === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : status === "success" ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : null}
            <span>{message}</span>
          </CardContent>
        </Card>
      )}

      {previewUrl && (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1"><CardTitle className="text-base">Pré-visualização do relatório</CardTitle><CardDescription>Confirme o conteúdo antes de descarregar ou enviar.</CardDescription></div>
            <Button variant="outline" className="w-full sm:w-fit" render={<a href={previewUrl} download="relatorios-preview.pdf" />}><ArrowDownToLine /> Descarregar PDF</Button>
          </CardHeader>
          <CardContent className="p-0"><iframe className="h-[75vh] min-h-[480px] w-full border-t bg-muted" title="Pré-visualização do relatório PDF" src={previewUrl} /></CardContent>
        </Card>
      )}

      {canSend && deliveryResults.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Resultado do envio</CardTitle><CardDescription>{deliveryResults.length} resultado(s) por destinatário.</CardDescription></CardHeader>
          <CardContent className="px-0 pb-4 sm:px-4">
            <div className="overflow-hidden rounded-xl border">
              <Table className="min-w-[620px]">
                <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><TableHead>Aluno</TableHead><TableHead>Destinatário</TableHead><TableHead className="text-right">Estado</TableHead></TableRow></TableHeader>
                <TableBody>{deliveryResults.map((result) => (
                  <TableRow key={`${result.studentName}-${result.email}`}>
                    <TableCell className="font-medium">{result.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{result.email}</TableCell>
                    <TableCell className="text-right"><Badge variant={result.success ? "secondary" : "destructive"}>{result.success ? "Enviado" : `Falhou: ${result.error ?? "erro desconhecido"}`}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {canSend && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Consultar envios com problemas</CardTitle>
            <CardDescription>Consulte falhas de entrega e devoluções por período, turma e canal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="audit-turma">Turma</Label>
                <Select value={auditTurmaId || null} disabled={!selectedPeriod || auditStatus === "loading"} onValueChange={(value) => { setAuditTurmaId(value ?? ""); setFailedDeliveries([]); setAuditStatus("idle"); }}>
                  <SelectTrigger id="audit-turma" className="h-10 w-full data-[size=default]:h-10"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>{turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" className="h-10" onClick={loadFailedDeliveries} disabled={!selectedPeriod || !auditTurmaId || auditStatus === "loading"}>
                {auditStatus === "loading" ? "A consultar..." : "Ver falhas"}
              </Button>
            </div>

            {auditStatus === "error" && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message || "Não foi possível consultar os envios."}</p>}
            {auditStatus === "loaded" && !failedDeliveries.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Não foram encontradas falhas para este período e turma.</p>}
            {failedDeliveries.length > 0 && (
              <div className="overflow-hidden rounded-xl border">
                <Table className="min-w-[720px]">
                  <TableHeader className="bg-muted/50"><TableRow className="hover:bg-transparent"><TableHead>Aluno</TableHead><TableHead>Destinatário</TableHead><TableHead>Motivo</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>{failedDeliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">{delivery.studentName}</TableCell>
                      <TableCell><div className="grid gap-0.5"><span>{delivery.recipientName || "Encarregado"}</span><span className="text-xs text-muted-foreground">{delivery.recipientEmail}</span></div></TableCell>
                      <TableCell className="max-w-[360px] whitespace-normal text-muted-foreground">{delivery.error || "Motivo não informado"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(delivery.attemptedAt).toLocaleString("pt-AO")}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
