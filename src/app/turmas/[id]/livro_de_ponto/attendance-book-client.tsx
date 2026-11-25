"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCheck, ClipboardCheck, History, Save, Users } from "lucide-react";
import { PageHeaderCard } from "@/components/page-header-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWeeklyCoordinationPeriods, formatPeriodDate } from "@/lib/weekly-coordination";

type Turma = {
  id: string;
  name: string;
  subjects: string[];
  roster: Array<{ id: string; name: string; age: number; avatarUrl?: string | null }>;
};
type LastRegisteredAbsence = { date: string; subject: string; tempo: string } | null;

const tempos = Array.from({ length: 8 }, (_, index) => `${index + 1}º tempo`);
const faultTypes = [
  { value: "FALTA_DE_MATERIAL", label: "Falta de material" },
  { value: "AUSENCIA_NA_SALA", label: "Ausência na sala" },
] as const;

function displayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? name;
}

function isWeekend(dateValue: string) {
  const day = new Date(`${dateValue}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function AttendanceBookClient({ turma, lastRegisteredAbsence: initialLastRegisteredAbsence }: { turma: Turma; lastRegisteredAbsence: LastRegisteredAbsence }) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  
  // Get current weekly period
  const weeklyPeriods = getWeeklyCoordinationPeriods(now.getFullYear());
  const firstPeriodStart = weeklyPeriods[0]?.start;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12);
  const datePickerMin = firstPeriodStart ? formatPeriodDate(firstPeriodStart) : todayKey;
  const datePickerMax = formatPeriodDate(monthEnd);
  
  const [date, setDate] = useState("");
  const [subject, setSubject] = useState(turma.subjects[0] ?? "");
  const [tempo, setTempo] = useState("1º tempo");
  const [faultType, setFaultType] = useState<(typeof faultTypes)[number]["value"]>("AUSENCIA_NA_SALA");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [otherSubjectAbsences, setOtherSubjectAbsences] = useState<Array<{ studentId: string; subject: string }>>([]);
  const [status, setStatus] = useState("");
  const [lastRegisteredAbsence, setLastRegisteredAbsence] = useState(initialLastRegisteredAbsence);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!date || !subject) {
      Promise.resolve().then(() => {
        setSelectedIds([]);
        setOtherSubjectAbsences([]);
        setIsLoading(false);
      });
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setIsLoading(true);
    });
    fetch(`/api/attendance-book?turmaId=${encodeURIComponent(turma.id)}&date=${encodeURIComponent(date)}&subject=${encodeURIComponent(subject)}&tempo=${encodeURIComponent(tempo)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as faltas.");
        return response.json();
      })
      .then((data: { absences?: Array<{ studentId: string; tempo: string; faultType: (typeof faultTypes)[number]["value"] }>; otherSubjectAbsences?: Array<{ studentId: string; subject: string }> }) => {
        if (!cancelled) {
          setSelectedIds((data.absences ?? []).map((absence) => absence.studentId));
          setOtherSubjectAbsences(data.otherSubjectAbsences ?? []);
          const savedFaultType = data.absences?.[0]?.faultType;
          if (savedFaultType) setFaultType(savedFaultType);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Não foi possível carregar as faltas.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, subject, tempo, turma.id]);

  function toggleStudent(studentId: string) {
    setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  function toggleAll() {
    const availableIds = turma.roster
      .filter((student) => !otherSubjectAbsences.some((absence) => absence.studentId === student.id))
      .map((student) => student.id);
    setSelectedIds((current) => availableIds.every((id) => current.includes(id)) ? [] : availableIds);
  }

  const availableStudents = turma.roster.filter((student) => !otherSubjectAbsences.some((absence) => absence.studentId === student.id));
  const allAvailableSelected = availableStudents.length > 0 && availableStudents.every((student) => selectedIds.includes(student.id));

  async function saveAttendance() {
    if (!date || !subject) {
      setStatus("Escolha a data e a disciplina antes de guardar.");
      return;
    }

    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/attendance-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id, date, subject, tempo, faultType, studentIds: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar o livro de ponto.");
      const savedMessage = `${data.saved ?? 0} nova(s) falta(s) guardada(s) para ${date}.`;
      const alreadyRecordedMessage = data.alreadyRecorded ? ` ${data.alreadyRecorded} falta(s) já estavam registadas e não foram alteradas.` : "";
      if (data.saved > 0) setLastRegisteredAbsence({ date, subject, tempo });
      setStatus(`${savedMessage}${alreadyRecordedMessage}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar o livro de ponto.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
      <PageHeaderCard
        badge="Registo de assiduidade"
        title="Livro de ponto"
        description={`Registe e acompanhe as faltas da turma ${turma.name}.`}
        icon={ClipboardCheck}
        action={<Button variant="outline" size="lg" render={<Link href={`/turmas/${turma.id}`} />}><ArrowLeft /> Voltar à turma</Button>}
      />

      <Card className="bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
        <CardContent className="flex items-start gap-3 sm:items-center" aria-live="polite">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="size-5" /></div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">Última falta registada por si</p>
            <p className="break-words text-sm text-muted-foreground">{lastRegisteredAbsence ? `${lastRegisteredAbsence.date.split("-").reverse().join("/")} · ${lastRegisteredAbsence.subject} · ${lastRegisteredAbsence.tempo}` : "Ainda não registou faltas no sistema."}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></div>
            <div><CardTitle>Detalhes do registo</CardTitle><CardDescription className="mt-1">Escolha a data, a disciplina e o tempo letivo.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <Label htmlFor="attendance-date">Data</Label>
              <Input id="attendance-date" className="block h-10 w-full min-w-0 max-w-full appearance-none" type="date" min={datePickerMin} max={datePickerMax} disabled={isSaving} value={date} onChange={(event) => { const nextDate = event.target.value; if (nextDate && isWeekend(nextDate)) { setDate(""); setSelectedIds([]); setStatus("A escola não oferece aulas aos fins de semana."); return; } setStatus(""); setDate(nextDate); }} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendance-subject">Disciplina</Label>
              <Select value={subject || null} onValueChange={(value) => { if (value) setSubject(value); }} disabled={isSaving || !turma.subjects.length}>
                <SelectTrigger id="attendance-subject" className="h-10 w-full"><SelectValue placeholder="Sem disciplinas">{subject || undefined}</SelectValue></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>{turma.subjects.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendance-tempo">Tempo letivo</Label>
              <Select value={tempo} onValueChange={(value) => { if (value) setTempo(value); }} disabled={isSaving}>
                <SelectTrigger id="attendance-tempo" className="h-10 w-full"><SelectValue>{tempo}</SelectValue></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>{tempos.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Tipo de falta</legend>
            <div className="flex flex-wrap gap-2">
              {faultTypes.map((entry) => <Button key={entry.value} type="button" variant={faultType === entry.value ? "default" : "outline"} className="h-10" onClick={() => setFaultType(entry.value)} disabled={isLoading || isSaving} aria-pressed={faultType === entry.value}>{entry.label}</Button>)}
            </div>
          </fieldset>
          {status && <p role="status" className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-foreground">{status}</p>}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></div>
            <div><CardTitle>Marcar faltas</CardTitle><CardDescription className="mt-1">Selecione os alunos com falta neste tempo letivo.</CardDescription></div>
          </div>
          <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={toggleAll} disabled={isLoading || isSaving || !availableStudents.length}><CheckCheck />{allAvailableSelected ? "Desmarcar todos" : "Selecionar todos"}</Button>
        </CardHeader>
        <CardContent className="grid gap-5">
          {turma.roster.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {turma.roster.map((student) => {
                const selected = selectedIds.includes(student.id);
                const conflict = otherSubjectAbsences.find((absence) => absence.studentId === student.id);
                const disabled = Boolean(conflict) || isLoading || isSaving;
                return (
                  <label key={student.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 transition-colors ${selected ? "border-primary/40 bg-primary/5" : "bg-card"} ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-primary/40 hover:bg-muted/40"}`}>
                    <Avatar className="size-12 shrink-0">
                      {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={`Fotografia de ${displayName(student.name)}`} />}
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary">{displayName(student.name).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block break-words text-sm font-semibold">{displayName(student.name)}</span>
                      <span className="block break-words text-xs text-muted-foreground">{selected ? "Falta selecionada" : conflict ? `Falta registada em ${conflict.subject}` : "Presente"}</span>
                    </span>
                    <Checkbox aria-label={`Marcar falta de ${student.name}`} checked={selected} disabled={disabled} onCheckedChange={() => toggleStudent(student.id)} />
                  </label>
                );
              })}
            </div>
          ) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não há alunos ativos nesta turma.</div>}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><ClipboardCheck className="size-4 shrink-0 text-primary" />{isLoading ? "A carregar registos..." : <><Badge variant="secondary">{selectedIds.length}</Badge> de {turma.roster.length} alunos selecionados</>}</div>
            <Button type="button" className="h-10 w-full sm:w-auto" onClick={saveAttendance} disabled={isSaving || isLoading}><Save />{isSaving ? "A guardar..." : "Guardar faltas"}</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
