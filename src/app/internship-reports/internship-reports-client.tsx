"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, ClipboardList, Plus, Save, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Report = {
  id: string;
  periodStart: string;
  periodEnd: string;
  companyName: string | null;
  position: string | null;
  performanceRating: number;
  strengths: string;
  improvementAreas: string;
  comments: string;
};
type Student = { id: string; name: string; active: boolean; avatarUrl: string | null; turma: { id: string; name: string }; internshipPerformanceReports: Report[] };
type FormState = Omit<Report, "id" | "periodStart" | "periodEnd"> & { periodStart: string; periodEnd: string };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyForm(): FormState {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { periodStart: localDate(start), periodEnd: localDate(today), companyName: "", position: "", performanceRating: 3, strengths: "", improvementAreas: "", comments: "" };
}

export function InternshipReportsClient() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/internship-reports");
      const data = await response.json();
      if (response.ok) {
        setStudents(data.students);
        setSelectedId((current) => data.students.some((student: Student) => student.id === current) ? current : data.students[0]?.id ?? "");
      } else setMessage(data.error ?? "Não foi possível carregar os alunos atribuídos.");
    } catch {
      setMessage("Não foi possível carregar os alunos atribuídos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch("/api/internship-reports")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok) {
          setStudents(data.students);
          setSelectedId(data.students[0]?.id ?? "");
        } else setMessage(data.error ?? "Não foi possível carregar os alunos atribuídos.");
        setLoading(false);
      })
      .catch(() => {
        setMessage("Não foi possível carregar os alunos atribuídos.");
        setLoading(false);
      });
  }, []);

  const filteredStudents = useMemo(() => students.filter((student) => `${student.name} ${student.turma.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [students, query]);
  const selectedStudent = students.find((student) => student.id === selectedId);

  function editReport(report: Report) {
    setForm({
      periodStart: report.periodStart.slice(0, 10),
      periodEnd: report.periodEnd.slice(0, 10),
      companyName: report.companyName ?? "",
      position: report.position ?? "",
      performanceRating: report.performanceRating,
      strengths: report.strengths,
      improvementAreas: report.improvementAreas,
      comments: report.comments,
    });
    setMessage("Relatório carregado para edição.");
  }

  function startNewReport() {
    setForm(emptyForm());
    setMessage("");
  }

  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/internship-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudent.id, ...form }),
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.error ?? "Não foi possível guardar o relatório.");
      else {
        setMessage("Relatório de estágio guardado.");
        await load();
      }
    } catch {
      setMessage("Não foi possível guardar o relatório.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]">
      <Card className="min-w-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></span><div><CardTitle>Alunos atribuídos</CardTitle><CardDescription className="mt-1">Selecione um aluno</CardDescription></div></div>
          <Badge variant="secondary">{students.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 pl-9" type="search" placeholder="Pesquisar aluno ou turma" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Pesquisar alunos" /></div>
          {loading ? <div role="status" aria-label="A carregar alunos" className="flex justify-center p-5 text-primary"><Spinner className="size-6" /></div> : filteredStudents.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {filteredStudents.map((student) => (
                <Button key={student.id} type="button" variant={selectedId === student.id ? "secondary" : "ghost"} aria-pressed={selectedId === student.id} disabled={saving} className="h-auto w-full min-w-0 justify-start gap-3 px-3 py-2.5 text-left" onClick={() => { setSelectedId(student.id); setForm(emptyForm()); setMessage(""); }}>
                  <Avatar className="size-10"><AvatarImage src={student.avatarUrl ?? undefined} alt="" /><AvatarFallback className="bg-primary/10 font-semibold text-primary">{student.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="block truncate text-xs text-muted-foreground">{student.turma.name}{student.active ? "" : " · Inativo"}</span></span>
                  <Badge variant="outline" aria-label={`${student.internshipPerformanceReports.length} relatórios`}>{student.internshipPerformanceReports.length}</Badge>
                </Button>
              ))}
            </div>
          ) : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{students.length ? "Nenhum resultado." : "Ainda não tem alunos de estágio atribuídos."}</p>}
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-sm">
        <CardContent className="grid gap-5">
          {!selectedStudent ? <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-8 text-center"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="size-6" /></span><h2 className="text-lg font-semibold">Relatórios de estágio</h2><p className="max-w-md text-sm text-muted-foreground">Os alunos atribuídos aparecerão aqui. Só terá acesso aos alunos selecionados pela administração.</p>{message && <p role="alert" className="text-sm text-destructive">{message}</p>}</div> : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-5">
                <div className="min-w-0 space-y-1"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{selectedStudent.turma.name} · Acompanhamento individual</p><h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{selectedStudent.name}</h2><p className="text-sm text-muted-foreground">Registe a avaliação da experiência profissional neste período.</p></div>
                <Badge variant="secondary"><BriefcaseBusiness /> Estágio</Badge>
              </header>

              {selectedStudent.internshipPerformanceReports.length > 0 && (
                <section className="grid gap-3 border-b pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Relatórios anteriores</h3><Button type="button" variant="outline" size="sm" disabled={saving} onClick={startNewReport}><Plus /> Novo relatório</Button></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedStudent.internshipPerformanceReports.map((report) => (
                      <Button key={report.id} type="button" variant="outline" disabled={saving} className="h-auto min-w-0 justify-between gap-3 p-3 text-left" onClick={() => editReport(report)}>
                        <span className="min-w-0"><span className="block text-xs font-semibold">{report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)}</span><span className="block truncate text-xs text-muted-foreground">{report.companyName || "Empresa não indicada"}</span></span><Badge variant="secondary">{report.performanceRating}/5</Badge>
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              <form className="grid gap-5" onSubmit={saveReport}>
                <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-5" /></span><div><h3 className="font-semibold">Avaliação de desempenho</h3><p className="mt-1 text-xs text-muted-foreground">Os relatórios são privados aos coordenadores atribuídos e à administração.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="internship-start">Data inicial</Label><Input id="internship-start" className="h-10" type="date" required value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /></div>
                  <div className="grid gap-2"><Label htmlFor="internship-end">Data final</Label><Input id="internship-end" className="h-10" type="date" required min={form.periodStart} value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /></div>
                  <div className="grid gap-2"><Label htmlFor="internship-company">Empresa de acolhimento</Label><Input id="internship-company" className="h-10" maxLength={160} value={form.companyName ?? ""} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Nome da empresa" /></div>
                  <div className="grid gap-2"><Label htmlFor="internship-position">Função / área de trabalho</Label><Input id="internship-position" className="h-10" maxLength={160} value={form.position ?? ""} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Ex.: Técnico de informática" /></div>
                </div>
                <div className="grid gap-2 sm:max-w-sm"><Label htmlFor="internship-rating">Avaliação global</Label><p id="internship-rating-help" className="text-xs text-muted-foreground">1 · Insuficiente &nbsp; 3 · Adequado &nbsp; 5 · Excelente</p><Select value={String(form.performanceRating)} onValueChange={(value) => { if (value) setForm({ ...form, performanceRating: Number(value) }); }}><SelectTrigger id="internship-rating" aria-describedby="internship-rating-help" className="w-full data-[size=default]:h-10"><SelectValue>{form.performanceRating} / 5</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{[1, 2, 3, 4, 5].map((rating) => <SelectItem key={rating} value={String(rating)}>{rating} / 5</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="internship-strengths">Pontos fortes</Label><Textarea id="internship-strengths" required maxLength={3000} rows={4} value={form.strengths} onChange={(event) => setForm({ ...form, strengths: event.target.value })} placeholder="Competências e atitudes positivas observadas" /></div>
                  <div className="grid gap-2"><Label htmlFor="internship-improvements">Aspetos a desenvolver</Label><Textarea id="internship-improvements" required maxLength={3000} rows={4} value={form.improvementAreas} onChange={(event) => setForm({ ...form, improvementAreas: event.target.value })} placeholder="Competências que podem ser reforçadas" /></div>
                </div>
                <div className="grid gap-2"><Label htmlFor="internship-comments">Observações e recomendações</Label><Textarea id="internship-comments" required maxLength={4000} rows={5} value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} placeholder="Descreva o desempenho do aluno e recomendações para o acompanhamento" /></div>
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p role="status" className="text-sm text-muted-foreground">{message}</p><Button type="submit" className="h-10 w-full sm:w-auto" disabled={saving}><Save /> {saving ? "A guardar..." : "Guardar relatório"}</Button></div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
