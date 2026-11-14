"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Star, Trash2, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const turmaOptions = [
  "1A", "1B", "2A", "2B", "2C", "3A", "3B", "4A", "4B", "4C",
  "5A", "5B", "5C", "6A", "6B", "6C", "7A", "7B", "7C", "7D",
  "8A", "8B", "9A", "9B", "10CEJ", "10CFBA", "10CFBB", "10CG", "10ETC", "10INF", "10OCC",
  "11CEJ", "11CFB", "11CG", "11ETC", "11INF", "11OCC", "12CEJ", "12CFB", "12CGB", "12CG", "12ETC",
  "12INF", "12OCC", "13CGB", "13CG", "13ETC", "13INF", "13OCC"
];

type AdminClientProps = {
  title?: string;
  eyebrow?: string;
  defaultRole?: "COORDENADOR" | "DIRECCAO";
};

type ExistingTeacher = { id: string; name: string; phone: string | null; role: string; user: { email: string }; turmaAssignments: { turmaId: string; isMain: boolean }[] };
type ExistingTurma = { id: string; name: string; coordinatorId: string | null };

export function AdminClient({
  title = "Criar professor e atribuir turmas",
  eyebrow = "NOVO COORDENADOR",
  defaultRole = "COORDENADOR",
}: AdminClientProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>(["10CEJ", "10CFBA", "10CFBB"]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [existingTeachers, setExistingTeachers] = useState<ExistingTeacher[]>([]);
  const [existingTurmas, setExistingTurmas] = useState<ExistingTurma[]>([]);
  const [assignmentState, setAssignmentState] = useState<Record<string, string[]>>({});
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"COORDENADOR" | "DIRECCAO" | "ADMIN">("COORDENADOR");
  const [turmaToAdd, setTurmaToAdd] = useState("");
  const [mainTurmaIds, setMainTurmaIds] = useState<string[]>([]);
  const [teacherPhone, setTeacherPhone] = useState("");

  async function loadAssignments() {
    const response = await fetch("/api/admin/teachers");
    if (!response.ok) return;
    const data = await response.json();
    setExistingTeachers(data.teachers);
    setExistingTurmas(data.turmas);
    setAssignmentState(Object.fromEntries(data.teachers.map((teacher: ExistingTeacher) => [teacher.id, teacher.turmaAssignments.map((assignment) => assignment.turmaId)])));
    const nextTeacherId = data.teachers.some((teacher: ExistingTeacher) => teacher.id === selectedTeacherId) ? selectedTeacherId : data.teachers[0]?.id || "";
    setSelectedTeacherId(nextTeacherId);
    const currentTeacher = data.teachers.find((teacher: ExistingTeacher) => teacher.id === nextTeacherId) ?? data.teachers[0];
    if (currentTeacher) setSelectedRole(currentTeacher.role as "COORDENADOR" | "DIRECCAO" | "ADMIN");
    if (currentTeacher) setTeacherPhone(currentTeacher.phone ?? "");
    if (currentTeacher) setMainTurmaIds(currentTeacher.turmaAssignments.filter((assignment: { turmaId: string; isMain: boolean }) => assignment.isMain).map((assignment: { turmaId: string }) => assignment.turmaId));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { Promise.resolve().then(() => loadAssignments()); }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          turmaNames: selectedTurmas,
          role: defaultRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar o professor.");
      }

      setStatus("success");
      const roleLabel = defaultRole === "DIRECCAO" ? "Direção" : "Professor";
      setMessage(`${roleLabel} criado com sucesso: ${data.teacher.name}`);
      setForm({ name: "", email: "", password: "" });
      setSelectedTurmas(["10CEJ", "10CFBA", "10CFBB"]);
      loadAssignments();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  function toggleTurma(turma: string) {
    setSelectedTurmas((current) =>
      current.includes(turma)
        ? current.filter((value) => value !== turma)
        : [...current, turma]
    );
  }

  async function saveAssignments(teacherId: string) {
    setAssignmentMessage("");
    const response = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, role: teacherId === selectedTeacherId ? selectedRole : existingTeachers.find((teacher) => teacher.id === teacherId)?.role, phone: teacherId === selectedTeacherId ? teacherPhone : undefined, turmaIds: assignmentState[teacherId] ?? [], mainTurmaIds: teacherId === selectedTeacherId ? mainTurmaIds : [] }),
    });
    const data = await response.json();
    setAssignmentMessage(response.ok ? "Atribuições atualizadas." : data.error ?? "Não foi possível atualizar as atribuições.");
    if (response.ok) loadAssignments();
  }

  async function removeUser(teacherId: string) {
    const teacher = existingTeachers.find((item) => item.id === teacherId);
    if (!teacher || !window.confirm(`Remover a conta de ${teacher.name}? Esta ação não pode ser anulada.`)) return;

    setAssignmentMessage("");
    const response = await fetch("/api/admin/teachers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId }),
    });
    const data = await response.json();
    setAssignmentMessage(response.ok ? "Conta removida com sucesso." : data.error ?? "Não foi possível remover a conta.");
    if (response.ok) loadAssignments();
  }

  async function resetUserPassword(teacherId: string) {
    if (resetPassword.length < 6) {
      setAssignmentMessage("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!window.confirm("Redefinir a palavra-passe desta conta?")) return;

    setAssignmentMessage("");
    const response = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, action: "resetPassword", newPassword: resetPassword }),
    });
    const data = await response.json();
    setAssignmentMessage(response.ok ? "Palavra-passe redefinida com sucesso." : data.error ?? "Não foi possível redefinir a palavra-passe.");
    if (response.ok) setResetPassword("");
  }

  const selectedTeacher = existingTeachers.find((teacher) => teacher.id === selectedTeacherId);
  const selectedTeacherTurmas = assignmentState[selectedTeacherId] ?? [];
  const availableTurmas = existingTurmas.filter((turma) => !selectedTeacherTurmas.includes(turma.id));

  function removeAssignment(turmaId: string) {
    setAssignmentState((current) => ({ ...current, [selectedTeacherId]: selectedTeacherTurmas.filter((id) => id !== turmaId) }));
  }

  function addAssignment() {
    if (!turmaToAdd) return;
    setAssignmentState((current) => ({ ...current, [selectedTeacherId]: [...selectedTeacherTurmas, turmaToAdd] }));
    setTurmaToAdd("");
  }

  return (
    <section className="grid gap-6">
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{defaultRole === "DIRECCAO" ? "Crie uma conta de direção e defina as turmas que poderá acompanhar." : "Crie uma conta de coordenação e atribua as turmas correspondentes."}</CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="admin-new-name">Nome</Label>
                <Input id="admin-new-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: João da Silva" className="h-10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-new-email">E-mail institucional</Label>
                <Input id="admin-new-email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nome@escola.ao" className="h-10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-new-password">Palavra-passe temporária</Label>
                <Input id="admin-new-password" required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Defina uma palavra-passe" className="h-10" />
              </div>
            </div>

            <Card className="border-border/70 bg-muted/20 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Turmas atribuídas</CardTitle>
                <CardDescription>{selectedTurmas.length} turma(s) selecionada(s)</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {turmaOptions.map((turma) => {
                  const checkboxId = `new-turma-${turma}`;
                  return (
                    <div key={turma} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                      <Checkbox id={checkboxId} checked={selectedTurmas.includes(turma)} onCheckedChange={() => toggleTurma(turma)} />
                      <Label htmlFor={checkboxId} className="flex-1 cursor-pointer text-sm">{turma}</Label>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {message ? (
                <p role={status === "error" ? "alert" : "status"} className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
              ) : <span />}
              <Button type="submit" disabled={status === "saving"}>
                <UserRound /> {status === "saving" ? "A guardar..." : defaultRole === "DIRECCAO" ? "Criar conta de direção" : "Criar professor"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <Badge variant="secondary" className="w-fit">ATRIBUIÇÕES EXISTENTES</Badge>
          <CardTitle className="text-xl">Gerir contas e turmas</CardTitle>
          <CardDescription>Atualize perfis, contactos e turmas atribuídas às contas existentes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          {existingTeachers.length > 0 && selectedTeacher ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,.7fr)]">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="admin-account-select">Conta</Label>
                  <Select value={selectedTeacherId || null} onValueChange={(teacherId) => {
                    if (!teacherId) return;
                    const teacher = existingTeachers.find((item) => item.id === teacherId);
                    setSelectedTeacherId(teacherId);
                    setSelectedRole((teacher?.role as "COORDENADOR" | "DIRECCAO" | "ADMIN") ?? "COORDENADOR");
                    setTeacherPhone(teacher?.phone ?? "");
                    setMainTurmaIds(teacher?.turmaAssignments.filter((assignment) => assignment.isMain).map((assignment) => assignment.turmaId) ?? []);
                    setTurmaToAdd("");
                    setResetPassword("");
                  }}>
                    <SelectTrigger id="admin-account-select" className="h-10 w-full data-[size=default]:h-10"><SelectValue placeholder="Selecione uma conta" /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>{existingTeachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.user.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Badge variant="outline" className="h-10 gap-2 px-3"><UserRound /> {selectedTeacherTurmas.length} turma(s) atribuída(s)</Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="admin-account-role">Perfil</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as "COORDENADOR" | "DIRECCAO" | "ADMIN")}>
                    <SelectTrigger id="admin-account-role" className="h-10 w-full data-[size=default]:h-10"><SelectValue /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}><SelectItem value="COORDENADOR">Coordenador</SelectItem><SelectItem value="DIRECCAO">Direção</SelectItem><SelectItem value="ADMIN">Administrador</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="admin-account-phone">Telefone</Label>
                  <Input id="admin-account-phone" type="tel" value={teacherPhone} onChange={(event) => setTeacherPhone(event.target.value)} placeholder="Ex.: +244 923 000 000" className="h-10" />
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1"><h3 className="font-semibold">Turmas da conta</h3><p className="text-sm text-muted-foreground">Marque a estrela para definir a turma principal do coordenador.</p></div>
                  <Button type="button" onClick={() => saveAssignments(selectedTeacher.id)}><Save /> Guardar alterações</Button>
                </div>

                {selectedTeacherTurmas.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedTeacherTurmas.map((turmaId) => {
                      const turmaName = existingTurmas.find((turma) => turma.id === turmaId)?.name ?? "Turma";
                      const isMain = mainTurmaIds.includes(turmaId);
                      return (
                        <div key={turmaId} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2">
                          <Button type="button" variant={isMain ? "secondary" : "ghost"} size="icon-sm" onClick={() => setMainTurmaIds((current) => current.includes(turmaId) ? current.filter((id) => id !== turmaId) : [...current, turmaId])} disabled={selectedRole !== "COORDENADOR"} aria-label={isMain ? `Remover ${turmaName} como turma principal` : `Definir ${turmaName} como turma principal`} title={selectedRole === "COORDENADOR" ? "Alternar turma principal" : "Disponível apenas para coordenadores"}>
                            <Star className={isMain ? "fill-current" : ""} />
                          </Button>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{turmaName}</span>
                          {isMain && <Badge variant="secondary" className="shrink-0">Principal</Badge>}
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => { removeAssignment(turmaId); setMainTurmaIds((current) => current.filter((id) => id !== turmaId)); }} aria-label={`Remover turma ${turmaName}`}><X /></Button>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhuma turma atribuída.</p>}

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Select value={turmaToAdd || null} onValueChange={(value) => setTurmaToAdd(value ?? "")}>
                    <SelectTrigger className="h-10 w-full data-[size=default]:h-10"><SelectValue placeholder="Adicionar uma turma..." /></SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>{availableTurmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addAssignment} disabled={!turmaToAdd}><Plus /> Adicionar turma</Button>
                </div>
              </div>

              <Card className="border-border/70 bg-muted/20 shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base">Segurança da conta</CardTitle><CardDescription>Redefina a palavra-passe ou remova a conta selecionada.</CardDescription></CardHeader>
                <CardContent className="grid gap-4 px-4 pb-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                  <div className="grid gap-2"><Label htmlFor="admin-reset-password">Nova palavra-passe temporária</Label><Input id="admin-reset-password" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} minLength={6} placeholder="Mínimo de 6 caracteres" className="h-10" /></div>
                  <Button type="button" variant="outline" onClick={() => resetUserPassword(selectedTeacher.id)} disabled={resetPassword.length < 6}>Redefinir palavra-passe</Button>
                  <Button type="button" variant="destructive" onClick={() => removeUser(selectedTeacher.id)}><Trash2 /> Remover conta</Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ainda não existem contas para editar.</p>
          )}

          {assignmentMessage && <p role="status" className="rounded-lg border bg-muted/50 p-3 text-sm text-foreground">{assignmentMessage}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
