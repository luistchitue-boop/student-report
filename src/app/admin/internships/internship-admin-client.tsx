"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, GraduationCap, Save, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type Student = { id: string; name: string; active: boolean; teacherIds: string[] };
type Turma = { id: string; name: string; isInternship: boolean; students: Student[] };
type Coordinator = { id: string; name: string; user: { email: string } };

export function InternshipAdminClient() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/internships", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as turmas.");

      const loadedTurmas: Turma[] = data.turmas ?? [];
      setTurmas(loadedTurmas);
      setCoordinators(data.coordinators ?? []);
      setSelectedTurmaId((current) => loadedTurmas.some((turma) => turma.id === current) ? current : loadedTurmas[0]?.id ?? "");
      setAssignments(Object.fromEntries(loadedTurmas.flatMap((turma) => turma.students.map((student) => [student.id, student.teacherIds]))));
      setMessage("");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar as turmas.");
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, []);

  const selectedTurma = useMemo(() => turmas.find((turma) => turma.id === selectedTurmaId), [turmas, selectedTurmaId]);

  async function updateMode(isInternship: boolean) {
    if (!selectedTurma) return;
    setBusy("mode");
    setMessage("");
    try {
      const response = await fetch("/api/admin/internships", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setTurmaMode", turmaId: selectedTurma.id, isInternship }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar a turma.");

      setTurmas((current) => current.map((turma) => turma.id === selectedTurma.id ? { ...turma, isInternship } : turma));
      setMessage(isInternship ? "Turma ativada para relatórios de estágio." : "Modo estágio desativado. As atribuições e relatórios foram preservados.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a turma.");
      setMessageIsError(true);
    } finally {
      setBusy("");
    }
  }

  async function saveStudent(student: Student) {
    setBusy(student.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/internships", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStudentAssignments", turmaId: selectedTurmaId, studentId: student.id, teacherIds: assignments[student.id] ?? [] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível guardar as atribuições.");
      setMessage(`Atribuições de ${student.name} guardadas.`);
      setMessageIsError(false);
      await load(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível guardar as atribuições.");
      setMessageIsError(true);
    } finally {
      setBusy("");
    }
  }

  function toggleCoordinator(studentId: string, coordinatorId: string, checked: boolean) {
    setAssignments((current) => {
      const assigned = current[studentId] ?? [];
      return {
        ...current,
        [studentId]: checked
          ? assigned.includes(coordinatorId) ? assigned : [...assigned, coordinatorId]
          : assigned.filter((id) => id !== coordinatorId),
      };
    });
  }

  if (loading) {
    return (
      <div className="grid gap-5" role="status" aria-label="A carregar turmas de estágio">
        <Card><CardHeader><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-full max-w-2xl" /></CardHeader><CardContent><Skeleton className="h-10 w-full max-w-sm" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}</CardContent></Card>
      </div>
    );
  }

  return (
    <section className="grid gap-5" aria-label="Configuração das turmas de estágio">
      {message && (
        <Card className={messageIsError ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"} role={messageIsError ? "alert" : "status"}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className={messageIsError ? "text-sm text-destructive" : "text-sm text-primary"}>{message}</p>
            {messageIsError && <Button type="button" variant="outline" size="sm" onClick={() => void load()}><Spinner /> Tentar novamente</Button>}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-primary/20 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <Badge variant="outline" className="w-fit gap-1.5"><GraduationCap /> Configuração isolada</Badge>
          <CardTitle className="pt-1 text-xl">Estágio profissional</CardTitle>
          <CardDescription>Ative apenas as turmas de finalistas. Os coordenadores atribuídos terão acesso apenas aos alunos selecionados; os relatórios escolares existentes não são alterados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5">
          <div className="grid max-w-md gap-2">
            <Label htmlFor="internship-turma">Turma</Label>
            <Select value={selectedTurmaId || null} onValueChange={(value) => { setSelectedTurmaId(value ?? ""); setMessage(""); }} disabled={!turmas.length}>
              <SelectTrigger id="internship-turma" className="h-10 w-full"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {turmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}{turma.isInternship ? " · Estágio" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!selectedTurma ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Não existem turmas disponíveis para configurar.</div>
          ) : (
            <Card className="gap-0 overflow-hidden py-0 shadow-none">
              <CardHeader className="flex flex-col gap-3 border-b bg-muted/30 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><UsersRound className="size-5" /></span>
                  <div className="grid gap-1">
                    <CardTitle className="text-base">{selectedTurma.name}</CardTitle>
                    <CardDescription>{selectedTurma.students.length} {selectedTurma.students.length === 1 ? "aluno" : "alunos"}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
                  {selectedTurma.isInternship && <Badge variant="secondary"><BadgeCheck /> Ativa</Badge>}
                  <Checkbox
                    id="internship-mode"
                    checked={selectedTurma.isInternship}
                    disabled={busy === "mode"}
                    onCheckedChange={(checked) => void updateMode(checked === true)}
                  />
                  <Label htmlFor="internship-mode" className="cursor-pointer text-sm">{busy === "mode" ? "A guardar…" : "Turma de estágio"}</Label>
                </div>
              </CardHeader>

              {selectedTurma.isInternship && (
                <CardContent className="grid gap-3 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">Acesso dos coordenadores</h3>
                      <p className="text-xs text-muted-foreground">Selecione quem pode consultar cada aluno.</p>
                    </div>
                    <Badge variant="outline">{coordinators.length} coordenador(es)</Badge>
                  </div>

                  {selectedTurma.students.length ? selectedTurma.students.map((student) => (
                    <Card key={student.id} className="gap-0 bg-muted/20 py-0 shadow-none">
                      <CardContent className="grid gap-3 p-3 lg:grid-cols-[minmax(150px,.8fr)_minmax(0,2fr)_auto] lg:items-center">
                        <div className="grid min-w-0 gap-1">
                          <p className="truncate text-sm font-medium">{student.name}</p>
                          <Badge variant={student.active ? "secondary" : "outline"} className="w-fit">{student.active ? "Ativo" : "Inativo"}</Badge>
                        </div>

                        <fieldset className="grid min-w-0 gap-2">
                          <legend className="text-xs font-medium text-muted-foreground">Coordenadores com acesso individual</legend>
                          {coordinators.length ? (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {coordinators.map((coordinator) => {
                                const checkboxId = `student-${student.id}-coordinator-${coordinator.id}`;
                                return (
                                  <div key={coordinator.id} className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-2">
                                    <Checkbox
                                      id={checkboxId}
                                      checked={(assignments[student.id] ?? []).includes(coordinator.id)}
                                      disabled={busy === student.id}
                                      onCheckedChange={(checked) => toggleCoordinator(student.id, coordinator.id, checked === true)}
                                    />
                                    <Label htmlFor={checkboxId} className="grid min-w-0 cursor-pointer gap-0.5">
                                      <span className="truncate text-xs font-medium">{coordinator.name}</span>
                                      <span className="truncate text-[11px] font-normal text-muted-foreground">{coordinator.user.email}</span>
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          ) : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Não existem coordenadores disponíveis para atribuir.</p>}
                        </fieldset>

                        <Button type="button" variant="outline" className="w-full lg:w-auto" onClick={() => void saveStudent(student)} disabled={busy === student.id || busy === "mode"}>
                          {busy === student.id ? <Spinner /> : <Save />} Guardar
                        </Button>
                      </CardContent>
                    </Card>
                  )) : (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Esta turma ainda não tem alunos.</p>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </CardContent>
      </Card>
    </section>
  );
}