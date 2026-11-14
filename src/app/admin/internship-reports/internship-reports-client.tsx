"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ExternalLink, FileText, Mail, MessageCircle, RefreshCw, Send, ShieldAlert, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type Delivery = {
  id: string;
  recipientName: string;
  recipientContact: string;
  channel: "EMAIL" | "WHATSAPP";
  status: "SENT" | "DELIVERED" | "BOUNCED" | "DELAYED" | "FAILED";
  error: string | null;
  attemptedAt: string;
};
type ParentContact = { id: string; name: string; email: string; phone: string };
type Report = {
  id: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  companyName: string | null;
  performanceRating: number;
  teacher: { name: string } | null;
  deliveries: Delivery[];
};
type Student = {
  id: string;
  name: string;
  active: boolean;
  turma: { id: string; name: string };
  parents: ParentContact[];
  internshipPerformanceReports: Report[];
};
type Turma = { id: string; name: string };
type SendResult = { studentName: string; parentName: string; success: boolean; error?: string };
type Channel = "EMAIL" | "WHATSAPP";

const deliveryStatus: Record<Delivery["status"], string> = {
  SENT: "Aceite para envio",
  DELIVERED: "Entregue",
  BOUNCED: "Devolvido",
  DELAYED: "Atrasado",
  FAILED: "Falhou",
};

function formatAttempt(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getDeliveryVariant(status: Delivery["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "DELIVERED") return "secondary";
  if (status === "FAILED" || status === "BOUNCED") return "destructive";
  if (status === "DELAYED") return "outline";
  return "default";
}

export function InternshipReportsAdminClient() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [bulkTurmaId, setBulkTurmaId] = useState("");
  const [bulkPeriodKey, setBulkPeriodKey] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [bulkResults, setBulkResults] = useState<SendResult[]>([]);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [confirmIndividualOpen, setConfirmIndividualOpen] = useState(false);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/internship-reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os relatórios de estágio.");

      const loadedTurmas: Turma[] = data.turmas ?? [];
      const loadedStudents: Student[] = data.students ?? [];
      const firstTurmaId = loadedTurmas[0]?.id ?? "";
      const defaultReport = loadedStudents.filter((student) => student.turma.id === firstTurmaId).flatMap((student) => student.internshipPerformanceReports)[0];
      const chosenStudent = loadedStudents.find((student) => student.id === selectedStudentId)
        ?? loadedStudents.find((student) => student.internshipPerformanceReports.length > 0)
        ?? loadedStudents[0];

      setTurmas(loadedTurmas);
      setStudents(loadedStudents);
      setBulkTurmaId((current) => loadedTurmas.some((turma) => turma.id === current) ? current : firstTurmaId);
      setBulkPeriodKey((current) => current || (defaultReport ? `${defaultReport.periodStart.slice(0, 10)}|${defaultReport.periodEnd.slice(0, 10)}` : ""));
      setSelectedStudentId(chosenStudent?.id ?? "");
      setSelectedReportId((current) => chosenStudent?.internshipPerformanceReports.some((report) => report.id === current)
        ? current
        : chosenStudent?.internshipPerformanceReports[0]?.id ?? "");
      setSelectedParentId((current) => chosenStudent?.parents.some((parent) => parent.id === current)
        ? current
        : chosenStudent?.parents[0]?.id ?? "");
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os relatórios de estágio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
    // Load once on mount; subsequent refreshes are action-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStudent = useMemo(() => students.find((student) => student.id === selectedStudentId), [students, selectedStudentId]);
  const selectedReport = selectedStudent?.internshipPerformanceReports.find((report) => report.id === selectedReportId);
  const selectedParent = selectedStudent?.parents.find((parent) => parent.id === selectedParentId);
  const pdfUrl = selectedReport ? `/api/admin/internship-reports/pdf?reportId=${encodeURIComponent(selectedReport.id)}` : "";
  const bulkStudents = useMemo(() => students.filter((student) => student.turma.id === bulkTurmaId && student.active), [students, bulkTurmaId]);
  const bulkPeriods = useMemo(() => {
    const periods = new Map<string, { key: string; label: string }>();
    for (const student of bulkStudents) {
      for (const report of student.internshipPerformanceReports) {
        const start = report.periodStart.slice(0, 10);
        const end = report.periodEnd.slice(0, 10);
        const key = `${start}|${end}`;
        periods.set(key, { key, label: `${start} — ${end}` });
      }
    }
    return Array.from(periods.values()).sort((left, right) => right.key.localeCompare(left.key));
  }, [bulkStudents]);
  const matchingBulkReports = useMemo(() => {
    if (!bulkPeriodKey) return [];
    return bulkStudents.flatMap((student) => {
      const reports = student.internshipPerformanceReports
        .filter((report) => `${report.periodStart.slice(0, 10)}|${report.periodEnd.slice(0, 10)}` === bulkPeriodKey)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return reports[0] ? [{ student, report: reports[0] }] : [];
    });
  }, [bulkStudents, bulkPeriodKey]);
  const bulkRecipientCount = matchingBulkReports.reduce((total, { student }) => total + student.parents.filter((parent) => channel === "EMAIL" ? Boolean(parent.email.trim()) : Boolean(parent.phone.trim())).length, 0);
  const currentDeliveries = selectedReport?.deliveries ?? [];
  const bulkProgressValue = bulkRecipientCount ? bulkResults.length / bulkRecipientCount * 100 : 0;
  const hasLoadError = Boolean(loadError);

  function selectStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    setSelectedStudentId(studentId);
    setSelectedReportId(student?.internshipPerformanceReports[0]?.id ?? "");
    setSelectedParentId(student?.parents[0]?.id ?? "");
    setMessage("");
  }

  async function sendReport() {
    if (!selectedReport || !selectedParent) return;
    setConfirmIndividualOpen(false);
    setSending(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch("/api/admin/internship-reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: selectedReport.id, parentId: selectedParent.id, channel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar o relatório.");
      await load(false);
      setMessage(channel === "EMAIL"
        ? `Relatório enviado para ${selectedParent.name}. O estado inicial é “aceite para envio”; a confirmação por e-mail pode demorar alguns instantes.`
        : `Relatório enviado para ${selectedParent.name} por WhatsApp.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o relatório.");
      setMessageIsError(true);
    } finally {
      setSending(false);
    }
  }

  async function sendTurmaReports() {
    if (!bulkTurmaId || !bulkPeriodKey || !matchingBulkReports.length || bulkSending) return;

    setConfirmBulkOpen(false);
    setBulkSending(true);
    setBulkResults([]);
    setBulkProgress(`A preparar ${bulkRecipientCount} envio(s)...`);
    setMessage("");
    setMessageIsError(false);
    const results: SendResult[] = [];
    let attempted = 0;
    for (const { student, report } of matchingBulkReports) {
      const eligibleParents = student.parents.filter((parent) => channel === "EMAIL" ? Boolean(parent.email.trim()) : Boolean(parent.phone.trim()));
      for (const parent of eligibleParents) {
        attempted += 1;
        setBulkProgress(`A enviar ${attempted}/${bulkRecipientCount}: ${student.name} → ${parent.name}`);
        try {
          const response = await fetch("/api/admin/internship-reports/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId: report.id, parentId: parent.id, channel }),
          });
          const data = await response.json();
          results.push({ studentName: student.name, parentName: parent.name, success: response.ok, ...(!response.ok ? { error: data.error ?? "Falha no envio." } : {}) });
        } catch (error) {
          results.push({ studentName: student.name, parentName: parent.name, success: false, error: error instanceof Error ? error.message : "Falha de ligação." });
        }
        setBulkResults([...results]);
      }
      if (!eligibleParents.length) results.push({ studentName: student.name, parentName: "—", success: false, error: `Sem contacto ${channel === "EMAIL" ? "de e-mail" : "telefónico"} registado.` });
    }
    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;
    setBulkResults(results);
    setBulkProgress("");
    setBulkSending(false);
    await load(false);
    setMessage(`${succeeded} envio(s) concluído(s)${failed ? `; ${failed} falharam ou foram ignorados` : ""}.`);
    setMessageIsError(failed > 0);
  }

  if (loading) {
    return (
      <section className="grid gap-5" aria-label="A carregar relatórios de estágio">
        <Card><CardHeader><Skeleton className="h-6 w-full max-w-2xl" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader><CardContent><Skeleton className="h-36 w-full" /></CardContent></Card>
        <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card><Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card></div>
      </section>
    );
  }

  return (
    <section className="grid gap-5" aria-label="Relatórios de estágio">
      {message && (
        <Card className={messageIsError ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"} role={messageIsError ? "alert" : "status"}>
          <CardContent className="p-4 text-sm">
            <p className={messageIsError ? "text-destructive" : "text-primary"}>{message}</p>
          </CardContent>
        </Card>
      )}

      {hasLoadError ? (
        <Card className="border-destructive/30 bg-destructive/5" role="alert">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-destructive">{loadError}</p></div>
            <Button type="button" variant="outline" onClick={() => void load()}><RefreshCw /> Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : !turmas.length ? (
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-2 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><UsersRound className="size-5" /></span>
            <CardTitle className="text-base">Sem turmas de estágio</CardTitle>
            <CardDescription className="max-w-lg">Marque primeiro uma turma como turma de estágio e atribua alunos na configuração de estágio.</CardDescription>
            <Button className="mt-2" variant="outline" render={<Link href="/admin/internships" />}>Configurar turmas</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-primary/20 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <Badge variant="outline" className="w-fit gap-1.5"><Send /> Envio em massa</Badge>
              <CardTitle className="pt-1 text-xl">Enviar relatórios por turma</CardTitle>
              <CardDescription>Envia o relatório atualizado mais recentemente para cada encarregado com um contacto válido no canal escolhido.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="bulk-turma">Turma de estágio</Label>
                  <Select value={bulkTurmaId || null} disabled={bulkSending} onValueChange={(value) => {
                    const nextTurmaId = value ?? "";
                    const nextReport = students.filter((student) => student.turma.id === nextTurmaId).flatMap((student) => student.internshipPerformanceReports)[0];
                    setBulkTurmaId(nextTurmaId);
                    setBulkPeriodKey(nextReport ? `${nextReport.periodStart.slice(0, 10)}|${nextReport.periodEnd.slice(0, 10)}` : "");
                    setBulkResults([]);
                    setMessage("");
                  }}>
                    <SelectTrigger id="bulk-turma" className="h-10 w-full"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>{turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="bulk-period">Período do relatório</Label>
                  <Select value={bulkPeriodKey || null} disabled={bulkSending || !bulkPeriods.length} onValueChange={(value) => { setBulkPeriodKey(value ?? ""); setBulkResults([]); setMessage(""); }}>
                    <SelectTrigger id="bulk-period" className="h-10 w-full"><SelectValue placeholder={bulkPeriods.length ? "Selecione um período" : "Sem relatórios disponíveis"} /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>{bulkPeriods.map((period) => <SelectItem key={period.key} value={period.key}>{period.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="bulk-channel">Canal de envio</Label>
                  <Select value={channel} disabled={bulkSending} onValueChange={(value) => value && setChannel(value as Channel)}>
                    <SelectTrigger id="bulk-channel" className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}><SelectItem value="EMAIL">E-mail (PDF em anexo)</SelectItem><SelectItem value="WHATSAPP">WhatsApp (PDF como documento)</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="h-7 px-2.5">{matchingBulkReports.length} aluno(s) com relatório</Badge>
                  <Badge variant="outline" className="h-7 px-2.5">{bulkRecipientCount} contacto(s) utilizável(is)</Badge>
                </div>
                <Button type="button" onClick={() => setConfirmBulkOpen(true)} disabled={bulkSending || !matchingBulkReports.length || !bulkRecipientCount}>
                  {bulkSending ? <Spinner /> : <Send />} {bulkSending ? "A enviar turma…" : `Enviar relatórios (${bulkRecipientCount})`}
                </Button>
              </div>

              {bulkProgress && <div className="grid gap-2" role="status"><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{bulkProgress}</span><span className="shrink-0 tabular-nums text-muted-foreground">{Math.min(bulkProgressValue, 100).toFixed(0)}%</span></div><Progress value={Math.min(bulkProgressValue, 100)} /></div>}
              {bulkResults.length > 0 && (
                <div className="grid max-h-64 gap-2 overflow-auto rounded-lg border p-3">
                  {bulkResults.map((result, index) => (
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-2 last:border-0 last:pb-0" key={`${result.studentName}-${result.parentName}-${index}`}>
                      <p className="text-sm">{result.success ? <Badge variant="secondary" className="mr-2">Enviado</Badge> : <Badge variant="destructive" className="mr-2">Falhou</Badge>}{result.studentName} · {result.parentName}</p>
                      {result.error && <p className="w-full text-xs text-destructive">{result.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.2fr)] lg:items-end">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="report-student">Aluno</Label>
                <Select value={selectedStudentId || null} onValueChange={(value) => value && selectStudent(value)}>
                  <SelectTrigger id="report-student" className="h-10 w-full"><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name} · {student.turma.name}{student.active ? "" : " · Inativo"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="report-record">Relatório de estágio</Label>
                <Select value={selectedReport?.id || null} disabled={!selectedStudent?.internshipPerformanceReports.length} onValueChange={(value) => { setSelectedReportId(value ?? ""); setMessage(""); }}>
                  <SelectTrigger id="report-record" className="h-10 w-full"><SelectValue placeholder={selectedStudent?.internshipPerformanceReports.length ? "Selecione um relatório" : "Ainda sem relatórios"} /></SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>{selectedStudent?.internshipPerformanceReports.map((report) => <SelectItem key={report.id} value={report.id}>{report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)} · {report.performanceRating}/5</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Os relatórios são criados pelos coordenadores atribuídos; esta área permite rever, exportar e enviar.</p>
            </CardContent>
          </Card>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
            <Card className="min-w-0 shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><FileText className="size-5" /></span>
                  <div className="grid gap-1"><CardTitle>Pré-visualização do relatório</CardTitle><CardDescription>{selectedStudent ? `${selectedStudent.name} · ${selectedStudent.turma.name}` : "Selecione um aluno e relatório."}</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4">
                {selectedReport ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                      <div className="grid gap-1 text-sm">
                        <p className="font-medium">{selectedReport.companyName || "Empresa não indicada"}</p>
                        <p className="text-xs text-muted-foreground">Avaliação {selectedReport.performanceRating}/5 · {selectedReport.teacher?.name ?? "Coordenador não indicado"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" render={<a href={`${pdfUrl}&download=1`} download />}><ArrowDownToLine /> Descarregar PDF</Button>
                        <Button variant="outline" size="sm" render={<a href={pdfUrl} target="_blank" rel="noreferrer" />}><ExternalLink /> Abrir PDF</Button>
                      </div>
                    </div>
                    <iframe className="h-[min(72vh,780px)] min-h-[340px] w-full rounded-lg border bg-muted/20" src={pdfUrl} title={`Pré-visualização do relatório de estágio de ${selectedStudent?.name}`} />
                  </>
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Este aluno ainda não tem um relatório de estágio registado.</div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Send className="size-5" /></span>
                  <div className="grid gap-1"><CardTitle>Enviar ao encarregado</CardTitle><CardDescription>Confirme o destinatário e o canal antes do envio.</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 pt-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="report-parent">Encarregado</Label>
                    <Select value={selectedParentId || null} disabled={!selectedStudent?.parents.length || sending || bulkSending} onValueChange={(value) => setSelectedParentId(value ?? "")}>
                      <SelectTrigger id="report-parent" className="h-10 w-full"><SelectValue placeholder={selectedStudent?.parents.length ? "Selecione um encarregado" : "Sem contactos registados"} /></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>{selectedStudent?.parents.map((parent) => <SelectItem key={parent.id} value={parent.id}>{parent.name} · {parent.email || parent.phone || "Sem contacto"}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="report-channel">Canal</Label>
                    <Select value={channel} disabled={sending || bulkSending} onValueChange={(value) => value && setChannel(value as Channel)}>
                      <SelectTrigger id="report-channel" className="h-10 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}><SelectItem value="EMAIL"><span className="inline-flex items-center gap-2"><Mail /> E-mail</span></SelectItem><SelectItem value="WHATSAPP"><span className="inline-flex items-center gap-2"><MessageCircle /> WhatsApp</span></SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedParent && (
                  <div className="grid gap-1 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Destino</p>
                    <p className="break-all text-sm">{channel === "EMAIL" ? selectedParent.email || "Sem e-mail registado" : selectedParent.phone || "Sem telefone registado"}</p>
                  </div>
                )}

                <Button type="button" className="w-full" onClick={() => setConfirmIndividualOpen(true)} disabled={sending || bulkSending || !selectedReport || !selectedParent || (channel === "EMAIL" ? !selectedParent.email : !selectedParent.phone)}>
                  {sending ? <Spinner /> : <Send />} {sending ? "A enviar…" : "Enviar relatório"}
                </Button>

                <div className="grid gap-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Histórico de envios</h3><Badge variant="secondary">{currentDeliveries.length}</Badge></div>
                  {currentDeliveries.length ? (
                    <div className="grid max-h-72 gap-2 overflow-auto">
                      {currentDeliveries.map((delivery) => (
                        <Card key={delivery.id} className="gap-0 bg-muted/20 py-0 shadow-none">
                          <CardContent className="flex min-w-0 flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="grid min-w-0 gap-1">
                              <p className="break-words text-sm font-medium">{delivery.recipientName} · {delivery.recipientContact}</p>
                              <p className="text-xs text-muted-foreground">{delivery.channel === "EMAIL" ? "E-mail" : "WhatsApp"} · {formatAttempt(delivery.attemptedAt)}{delivery.error ? ` · ${delivery.error}` : ""}</p>
                            </div>
                            <Badge variant={getDeliveryVariant(delivery.status)} className="w-fit shrink-0">{deliveryStatus[delivery.status]}</Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Ainda não existem envios para este relatório.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <DialogContent>
          <DialogCloseButton aria-label="Fechar" />
          <DialogHeader>
            <DialogTitle>Confirmar envio em massa</DialogTitle>
            <DialogDescription>
              Enviar os relatórios do período {bulkPeriodKey.replace("|", " a ")} de {matchingBulkReports.length} aluno(s) da turma {turmas.find((turma) => turma.id === bulkTurmaId)?.name ?? "selecionada"} a {bulkRecipientCount} encarregado(s) por {channel === "EMAIL" ? "e-mail" : "WhatsApp"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmBulkOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void sendTurmaReports()} disabled={!bulkRecipientCount}><Send /> Confirmar envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmIndividualOpen} onOpenChange={setConfirmIndividualOpen}>
        <DialogContent>
          <DialogCloseButton aria-label="Fechar" />
          <DialogHeader>
            <DialogTitle>Confirmar envio do relatório</DialogTitle>
            <DialogDescription>
              Enviar o relatório de {selectedStudent?.name ?? "aluno"} para {selectedParent?.name ?? "o encarregado selecionado"} por {channel === "EMAIL" ? "e-mail" : "WhatsApp"}?
              {selectedParent && <span className="mt-2 block break-all font-medium text-foreground">{channel === "EMAIL" ? selectedParent.email : selectedParent.phone}</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmIndividualOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void sendReport()} disabled={sending}><Send /> Confirmar envio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}