"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Download, Mail, RefreshCw, RotateCcw, Send, ShieldAlert, TriangleAlert } from "lucide-react";
import { isSendableEmailAddress } from "@/lib/email-address";
import { getPaginationItems } from "@/lib/pagination";
import { getMonthlyCoordinationPeriods, getPeriodLabel } from "@/lib/weekly-coordination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DeliveryIssue = {
  id: string;
  turmaId: string;
  studentId: string;
  turmaName: string;
  studentName: string;
  parents: Array<{ id: string; name: string; email: string; phone: string }>;
  recipientName: string | null;
  recipientEmail: string;
  parentId: string | null;
  status: "FAILED" | "BOUNCED" | "DELAYED" | "NOT_SENT";
  error: string | null;
  attemptedAt: string | null;
};
type TurmaSummary = { id: string; name: string; studentCount: number; sentCount: number; percentage: number; failedCount: number; bouncedCount: number; delayedCount: number };

function getAvailableMonths() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => getMonthlyCoordinationPeriods(year - index))
    .flat()
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

const statusLabels: Record<DeliveryIssue["status"], string> = {
  BOUNCED: "Devolvido (bounce)",
  FAILED: "Falhou / não enviado",
  DELAYED: "Atrasado / não entregue",
  NOT_SENT: "Ainda não enviado",
};
type DeliveryStatusFilter = "ALL" | DeliveryIssue["status"];
const RECIPIENTS_PER_BATCH = 5;
const MAX_PARALLEL_BATCHES = 2;
const PAGE_SIZE = 10;

const pdfColumns = [
  { label: "Aluno", width: 124 },
  { label: "Turma", width: 62 },
  { label: "Encarregado(s)", width: 142 },
  { label: "Telefone(s)", width: 98 },
  { label: "Estado", width: 97 },
];

function exportIssuesPdf(issues: DeliveryIssue[], periodLabel: string, turmaName: string) {
  const document = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 36;
  const tableWidth = pdfColumns.reduce((total, column) => total + column.width, 0);
  let pageNumber = 1;
  let y = 0;

  const drawTableHeader = (top: number) => {
    document.setFillColor(23, 48, 68);
    document.rect(margin, top, tableWidth, 25, "F");
    document.setFont("helvetica", "bold");
    document.setFontSize(8);
    document.setTextColor(255, 255, 255);
    let x = margin;
    for (const column of pdfColumns) {
      document.text(column.label, x + 7, top + 16);
      x += column.width;
    }
    return top + 25;
  };

  const drawPageHeading = (continuation = false) => {
    document.setTextColor(23, 48, 68);
    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text(continuation ? "RELATÓRIO DE ENVIOS · CONTINUAÇÃO" : "RELATÓRIO DE ESTADO DE ENVIO", margin, 42);
    if (!continuation) {
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(71, 85, 105);
      document.text(`Período: ${periodLabel}   ·   Turma: ${turmaName}`, margin, 61);
      document.text(`Registos: ${issues.length}   ·   Gerado em: ${new Date().toLocaleDateString("pt-AO")}`, margin, 76);
    }
    y = drawTableHeader(continuation ? 64 : 94);
  };

  drawPageHeading();
  document.setFont("helvetica", "normal");
  document.setFontSize(8);

  for (const issue of issues) {
    const recipientName = issue.recipientName?.trim();
    const normalizedEmail = issue.recipientEmail.trim().toLowerCase();
    const recipientParent = issue.parents.find((parent) => parent.email.trim().toLowerCase() === normalizedEmail)
      ?? issue.parents.find((parent) => recipientName && parent.name.trim().toLowerCase() === recipientName.toLowerCase());
    const parentName = recipientName || recipientParent?.name || "Encarregado";
    const values = [
      issue.studentName,
      issue.turmaName,
      parentName,
      recipientParent?.phone || "—",
      statusLabels[issue.status],
    ];
    const lines = values.map((value, index) => document.splitTextToSize(value || "—", pdfColumns[index].width - 14) as string[]);
    const lineCount = Math.max(...lines.map((cellLines) => cellLines.length));
    const rowHeight = Math.max(30, lineCount * 11 + 12);

    if (y + rowHeight > pageHeight - 42) {
      document.addPage();
      pageNumber += 1;
      drawPageHeading(true);
    }

    document.setFillColor(pageNumber % 2 ? 248 : 241, pageNumber % 2 ? 250 : 245, pageNumber % 2 ? 252 : 249);
    document.rect(margin, y, tableWidth, rowHeight, "F");
    let x = margin;
    for (let index = 0; index < values.length; index += 1) {
      document.setTextColor(51, 65, 85);
      document.text(lines[index], x + 7, y + 15, { lineHeightFactor: 1.25 });
      x += pdfColumns[index].width;
    }
    document.setDrawColor(226, 232, 240);
    document.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  }

  for (let page = 1; page <= document.getNumberOfPages(); page += 1) {
    document.setPage(page);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.setTextColor(100, 116, 139);
    document.text(`Documento confidencial · ${page}/${document.getNumberOfPages()}`, margin, pageHeight - 20);
  }

  const periodStart = periodLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  document.save(`relatorio-envios-${periodStart || "periodo"}.pdf`);
}

export function DeliveryIssuesClient() {
  const months = useMemo(() => getAvailableMonths(), []);
  const [periodKey, setPeriodKey] = useState(() => months[0]?.key ?? "");
  const [turmaId, setTurmaId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>("ALL");
  const [validEmailOnly, setValidEmailOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<DeliveryIssue[]>([]);
  const [summary, setSummary] = useState<TurmaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number; sent: number; failed: number; blocked: number } | null>(null);
  const [bulkResult, setBulkResult] = useState("");
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; message: string; success: boolean } | null>(null);

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
        return data as { issues?: DeliveryIssue[]; summary?: TurmaSummary[] };
      })
      .then((data) => {
        if (!cancelled) {
          setIssues(data.issues ?? []);
          setSummary(data.summary ?? []);
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível consultar os envios."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodKey]);

  const filteredIssues = issues.filter((issue) =>
    (turmaId === "all" || issue.turmaId === turmaId)
    && (statusFilter === "ALL" || issue.status === statusFilter)
    && (!validEmailOnly || isSendableEmailAddress(issue.recipientEmail)));
  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = getPaginationItems(currentPage, totalPages);
  const visibleIssues = filteredIssues.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedTurmaName = turmaId === "all" ? "Todas as turmas" : summary.find((turma) => turma.id === turmaId)?.name ?? "Turma";
  const selectedPeriodLabel = getPeriodLabel(months.find((month) => month.key === periodKey) ?? months[0]);
  const counts = filteredIssues.reduce((result, issue) => ({ ...result, [issue.status]: result[issue.status] + 1 }), { FAILED: 0, BOUNCED: 0, DELAYED: 0, NOT_SENT: 0 });
  const eligibleUnsentIssues = issues.filter((issue) =>
    issue.status === "NOT_SENT"
    && issue.parentId !== null
    && isSendableEmailAddress(issue.recipientEmail)
    && (turmaId === "all" || issue.turmaId === turmaId));

  async function refreshDeliveryStatus() {
    if (!periodKey) return null;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports/delivery-status?periodKey=${encodeURIComponent(periodKey)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o estado dos envios.");
      const latestIssues = (data.issues ?? []) as DeliveryIssue[];
      setIssues(latestIssues);
      setSummary(data.summary ?? []);
      return latestIssues;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o estado dos envios.");
      return null;
    } finally {
      setRefreshing(false);
    }
  }

  async function retryDelivery(issue: DeliveryIssue) {
    setRetryingId(issue.id);
    setRetryFeedback(null);
    try {
      const currentParent = issue.parentId ? issue.parents.find((parent) => parent.id === issue.parentId) : undefined;
      const contactChanged = issue.status !== "NOT_SENT"
        && currentParent
        && currentParent.email.trim().toLowerCase() !== issue.recipientEmail.trim().toLowerCase();
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issue.status === "NOT_SENT" || contactChanged
          ? { turmaIds: [issue.turmaId], studentIds: [issue.studentId], parentIds: issue.parentId ? [issue.parentId] : [], periodKey, channel: "EMAIL" }
          : { retryDeliveryId: issue.id }),
      });
      const data = await response.json();
      if (!response.ok || data.failed > 0 || data.sent !== 1) {
        const failedResult = Array.isArray(data.results) ? data.results.find((result: { success?: boolean }) => !result.success) : null;
        throw new Error(data.error || failedResult?.error || "Não foi possível reenviar este e-mail.");
      }

      await refreshDeliveryStatus();
      setRetryFeedback({ id: issue.id, message: `E-mail reenviado para ${issue.recipientEmail}.`, success: true });
    } catch (reason) {
      setRetryFeedback({ id: issue.id, message: reason instanceof Error ? reason.message : "Não foi possível reenviar este e-mail.", success: false });
    } finally {
      setRetryingId(null);
    }
  }

  async function sendAllUnsentReports() {
    if (bulkSending || !periodKey) return;
    setBulkSending(true);
    setBulkResult("");
    setError("");
    try {
      const currentIssues = await refreshDeliveryStatus();
      if (!currentIssues) return;
      const candidates = currentIssues.filter((issue) =>
        issue.status === "NOT_SENT"
        && issue.parentId !== null
        && isSendableEmailAddress(issue.recipientEmail)
        && (turmaId === "all" || issue.turmaId === turmaId));
      if (!candidates.length) {
        setBulkResult("Não há e-mails válidos ainda não enviados para o período e turma selecionados.");
        return;
      }
      if (!window.confirm(`Enviar os relatórios para ${candidates.length} destinatário(s) válido(s) ainda não enviado(s)?`)) return;

      const batches: DeliveryIssue[][] = [];
      for (let index = 0; index < candidates.length; index += RECIPIENTS_PER_BATCH) {
        batches.push(candidates.slice(index, index + RECIPIENTS_PER_BATCH));
      }
      let nextBatchIndex = 0;
      let completed = 0;
      let sent = 0;
      let failed = 0;
      let blocked = 0;
      setBulkProgress({ completed, total: candidates.length, sent, failed, blocked });

      const processNextBatch = async () => {
        while (nextBatchIndex < batches.length) {
          const batch = batches[nextBatchIndex++];
          try {
            const response = await fetch("/api/admin/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channel: "EMAIL",
                periodKey,
                turmaIds: [...new Set(batch.map((issue) => issue.turmaId))],
                studentIds: [...new Set(batch.map((issue) => issue.studentId))],
                deliveryRecipients: batch.map((issue) => ({ studentId: issue.studentId, parentId: issue.parentId })),
              }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Não foi possível enviar este lote.");
            sent += Number(data.sent) || 0;
            failed += Number(data.failed) || 0;
            const blockedStudentIds = new Set<string>((data.skippedStudents ?? []).map((student: { studentId: string }) => student.studentId));
            blocked += batch.filter((issue) => blockedStudentIds.has(issue.studentId)).length;
          } catch {
            failed += batch.length;
          } finally {
            completed += batch.length;
            setBulkProgress({ completed, total: candidates.length, sent, failed, blocked });
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_BATCHES, batches.length) }, () => processNextBatch()));
      await refreshDeliveryStatus();
      setBulkResult(`Envios concluídos: ${sent} enviado(s), ${failed} falhou/falharam, ${blocked} bloqueado(s) por falta de dados mensais.`);
    } finally {
      setBulkSending(false);
      setBulkProgress(null);
    }
  }

  async function exportLatestIssuesPdf() {
    if (!periodKey) return;
    setExporting(true);
    try {
      const latestIssues = await refreshDeliveryStatus();
      if (!latestIssues) return;
      const latestFilteredIssues = latestIssues.filter((issue) =>
        (turmaId === "all" || issue.turmaId === turmaId)
        && (statusFilter === "ALL" || issue.status === statusFilter)
        && (!validEmailOnly || isSendableEmailAddress(issue.recipientEmail)));
      exportIssuesPdf(latestFilteredIssues, selectedPeriodLabel, selectedTurmaName);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" render={<Link href="/admin/relatorios" />}><ArrowLeft /> Voltar aos relatórios</Button>
          <div className="space-y-1">
            <Badge variant="secondary" className="w-fit gap-1.5"><Mail className="size-3.5" /> Auditoria de e-mail</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Falhas e e-mails devolvidos</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">Consulte destinatários com falhas de envio, devoluções ou notificações de atraso.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refreshDeliveryStatus} disabled={loading || refreshing || exporting || bulkSending}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> {refreshing ? "A atualizar..." : "Atualizar lista"}
          </Button>
          <Button type="button" onClick={exportLatestIssuesPdf} disabled={loading || refreshing || exporting || bulkSending}>
            <Download /> {exporting ? "A atualizar e exportar..." : "Exportar PDF"}
          </Button>
        </div>
      </header>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtre a lista por período, turma, estado ou validade do endereço.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="issues-period">Período mensal</Label>
            <Select value={periodKey || null} disabled={bulkSending} onValueChange={(value) => { if (value) { setPeriodKey(value); setPage(1); } }}>
              <SelectTrigger id="issues-period" className="h-10 w-full data-[size=default]:h-10"><SelectValue placeholder="Selecione um período" /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>{months.map((month) => <SelectItem key={month.key} value={month.key}>{getPeriodLabel(month)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="issues-turma">Turma</Label>
            <Select value={turmaId} disabled={bulkSending} onValueChange={(value) => { if (value) { setTurmaId(value); setPage(1); } }}>
              <SelectTrigger id="issues-turma" className="h-10 w-full data-[size=default]:h-10"><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {summary.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="issues-status">Estado</Label>
            <Select value={statusFilter} disabled={bulkSending} onValueChange={(value) => { setStatusFilter(value as DeliveryStatusFilter); setPage(1); }}>
              <SelectTrigger id="issues-status" className="h-10 w-full data-[size=default]:h-10"><SelectValue /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="ALL">Todos os estados</SelectItem>
                <SelectItem value="NOT_SENT">Ainda não enviado</SelectItem>
                <SelectItem value="FAILED">Falhou / não enviado</SelectItem>
                <SelectItem value="BOUNCED">Devolvido (bounce)</SelectItem>
                <SelectItem value="DELAYED">Atrasado / não entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 self-end rounded-lg border px-3 py-2.5 sm:col-span-2 xl:col-span-1">
            <Checkbox id="issues-valid-email" checked={validEmailOnly} disabled={bulkSending} onCheckedChange={(checked) => { setValidEmailOnly(checked === true); setPage(1); }} />
            <Label htmlFor="issues-valid-email" className="cursor-pointer text-sm">Apenas e-mails válidos</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">Envio em lote</h3>
            <p className="text-sm text-muted-foreground">Envia apenas para e-mails válidos sem registo no período selecionado, em lotes controlados.</p>
          </div>
          <Button type="button" className="w-full sm:w-fit" onClick={sendAllUnsentReports} disabled={loading || refreshing || exporting || bulkSending}>
            <Send /> {bulkSending ? `A enviar ${bulkProgress?.completed ?? 0}/${bulkProgress?.total ?? eligibleUnsentIssues.length}...` : `Enviar relatórios não enviados (${eligibleUnsentIssues.length})`}
          </Button>
        </CardContent>
        {bulkProgress && (
          <CardContent className="grid gap-2 border-t px-5 py-4" role="status">
            <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <span>{bulkProgress.completed} de {bulkProgress.total} processados</span>
              <span>{bulkProgress.sent} enviado(s) · {bulkProgress.failed} falhou/falharam · {bulkProgress.blocked} bloqueado(s)</span>
            </div>
            <Progress value={bulkProgress.completed} max={bulkProgress.total} />
          </CardContent>
        )}
      </Card>

      {bulkResult && <Card role="status" className="border-primary/30 bg-primary/5 shadow-none"><CardContent className="flex items-start gap-2 p-4 text-sm text-primary"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{bulkResult}</CardContent></Card>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos envios filtrados">
        {[
          { label: "Devolvidos", value: counts.BOUNCED, icon: Mail, variant: "destructive" as const },
          { label: "Falhas de envio", value: counts.FAILED, icon: ShieldAlert, variant: "destructive" as const },
          { label: "Atrasados", value: counts.DELAYED, icon: Clock3, variant: "outline" as const },
          { label: "Ainda não enviados", value: counts.NOT_SENT, icon: TriangleAlert, variant: "secondary" as const },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="shadow-sm">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="space-y-1"><CardDescription>{metric.label}</CardDescription><CardTitle className="text-2xl tabular-nums">{metric.value}</CardTitle></div>
                <Badge variant={metric.variant} className="size-9 justify-center rounded-full p-0"><Icon /></Badge>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {retryFeedback && (
        <Card role={retryFeedback.success ? "status" : "alert"} className={retryFeedback.success ? "border-primary/30 bg-primary/5 shadow-none" : "border-destructive/30 bg-destructive/5 shadow-none"}>
          <CardContent className={`flex items-start gap-2 p-4 text-sm ${retryFeedback.success ? "text-primary" : "text-destructive"}`}>
            {retryFeedback.success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}{retryFeedback.message}
          </CardContent>
        </Card>
      )}

      {error ? (
        <Card role="alert" className="border-destructive/30 bg-destructive/5 shadow-none"><CardContent className="flex items-start gap-2 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</CardContent></Card>
      ) : loading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">A carregar o detalhe dos envios...</CardContent></Card>
      ) : !filteredIssues.length ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-5" /></span>
            <div className="space-y-1"><CardTitle className="text-base">Nenhum registo encontrado</CardTitle><CardDescription>Não há envios que correspondam ao período, turma, estado e filtro de e-mail selecionados.</CardDescription></div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Destinatários com problemas</CardTitle>
            <CardDescription>{Math.min(filteredIssues.length, (currentPage - 1) * PAGE_SIZE + 1)}–{Math.min(currentPage * PAGE_SIZE, filteredIssues.length)} de {filteredIssues.length} registo(s) · {selectedPeriodLabel} · {selectedTurmaName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table className="min-w-[1080px]">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Estado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Aluno / turma</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Destinatário</TableHead>
                    <TableHead className="min-w-[240px] text-xs uppercase tracking-wide text-muted-foreground">Motivo reportado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Tentativa</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleIssues.map((issue) => {
                    const statusVariant = issue.status === "BOUNCED" || issue.status === "FAILED" ? "destructive" : issue.status === "DELAYED" ? "outline" : "secondary";
                    return (
                      <TableRow key={issue.id}>
                        <TableCell><Badge variant={statusVariant}>{statusLabels[issue.status]}</Badge></TableCell>
                        <TableCell className="whitespace-normal"><div className="grid gap-0.5"><strong className="font-medium text-foreground">{issue.studentName}</strong><span className="text-xs text-muted-foreground">{issue.turmaName}</span></div></TableCell>
                        <TableCell className="whitespace-normal"><div className="grid gap-0.5"><strong className="font-medium text-foreground">{issue.recipientName || "Encarregado"}</strong><span className="break-all text-xs text-muted-foreground">{issue.recipientEmail}</span></div></TableCell>
                        <TableCell className="max-w-[360px] whitespace-normal break-words text-sm text-muted-foreground">{issue.error || "O serviço de e-mail não forneceu detalhes adicionais."}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{issue.attemptedAt ? new Date(issue.attemptedAt).toLocaleString("pt-AO", { dateStyle: "medium", timeStyle: "short" }) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {issue.status === "FAILED" || issue.status === "NOT_SENT" ? (
                            <Button type="button" size="sm" onClick={() => retryDelivery(issue)} disabled={retryingId !== null || bulkSending}>
                              <RotateCcw /> {retryingId === issue.id ? "A enviar..." : issue.status === "NOT_SENT" ? "Enviar relatório" : "Reenviar e-mail"}
                            </Button>
                          ) : <span className="inline-block max-w-48 whitespace-normal text-left text-xs text-muted-foreground">{issue.status === "BOUNCED" ? "Corrija o endereço antes de reenviar." : "Aguarde a atualização do serviço."}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-2 border-t px-4 py-4" aria-label="Paginação dos registos de envio">
                <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <ArrowLeft /> Anterior
                </Button>
                <div className="flex items-center gap-1" aria-label="Páginas dos registos de envio">
                  {pageItems.map((item, index) => typeof item === "number" ? (
                    <Button key={`${item}-${index}`} type="button" variant={item === currentPage ? "default" : "ghost"} size="icon" aria-current={item === currentPage ? "page" : undefined} aria-label={`Página ${item}`} onClick={() => setPage(item)}>
                      {item}
                    </Button>
                  ) : <span key={item} className="px-2 text-sm text-muted-foreground" aria-hidden="true">…</span>)}
                </div>
                <Button type="button" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  Próxima <ArrowRight />
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-muted/30 shadow-none">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <ArrowUpRight className="mt-0.5 size-4 shrink-0" />
          <p>Os eventos de devolução e atraso são recebidos através do webhook do Resend. Configure o endpoint <strong className="font-medium text-foreground">/api/webhooks/resend</strong> e a variável <strong className="font-medium text-foreground">RESEND_WEBHOOK_SECRET</strong> no serviço de e-mail.</p>
        </CardContent>
      </Card>
    </section>
  );
}
