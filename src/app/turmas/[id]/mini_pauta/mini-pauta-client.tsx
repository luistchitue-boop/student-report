"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, ClipboardList, Download, FileSpreadsheet, Save, Upload } from "lucide-react";
import { PageHeaderCard } from "@/components/page-header-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { importMiniPautaGrades, MiniPautaImportValidationError } from "@/lib/mini-pauta-import";
import { assertReportAccess } from "@/lib/report-access-client";

type Turma = {
  id: string;
  name: string;
  gradeScale: number;
  educationType: "ENSINO_GERAL" | "ENSINO_TECNICO" | null;
  subjects: string[];
  roster: Array<{ id: string; name: string; age: number; avatarUrl?: string | null }>;
};
type GradeAssessmentType = "AC2" | "NPP" | "NPT" | "";
type Trimester = "I" | "II" | "III" | "";

function GradeSelect({ id, label, value, onChange, options, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string; disabled?: boolean }>; disabled?: boolean }) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || "__empty__"} onValueChange={(next) => { if (next !== null) onChange(next === "__empty__" ? "" : next); }} disabled={disabled}>
        <SelectTrigger id={id} className="w-full bg-background data-[size=default]:h-10"><SelectValue placeholder="Selecione">{options.find((option) => option.value === value)?.label}</SelectValue></SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>{options.map((option) => <SelectItem key={option.value || "__empty__"} value={option.value || "__empty__"} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function displayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? name;
}

export function MiniPautaClient({ turma }: { turma: Turma }) {
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const assessmentOptions: Array<{ value: GradeAssessmentType; label: string }> = [
    { value: "", label: "Nota normal · AC1" },
    ...(turma.educationType === "ENSINO_GERAL" ? [{ value: "AC2" as const, label: "AC2" }] : []),
    ...(turma.educationType === "ENSINO_TECNICO" ? [{ value: "NPP" as const, label: "NPP" }] : []),
    { value: "NPT", label: "NPT" },
  ];
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [subject, setSubject] = useState(turma.subjects[0] ?? "");
  const [assessmentType, setAssessmentType] = useState<GradeAssessmentType>("");
  const [trimester, setTrimester] = useState<Trimester>("");
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importValidationError, setImportValidationError] = useState<MiniPautaImportValidationError | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exportSubject, setExportSubject] = useState(turma.subjects[0] ?? "");
  const [exportAssessmentType, setExportAssessmentType] = useState<GradeAssessmentType>("");
  const [exportTrimester, setExportTrimester] = useState<Trimester>("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [closedPeriods, setClosedPeriods] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    async function loadClosedPeriods() {
      try {
        const response = await fetch("/api/admin/closed-periods");
        if (!response.ok) return;
        const data = await response.json();
        
        const closed = new Map<string, boolean>();
        const closedPeriodsFromApi = (data.closedPeriods ?? []) as Array<{ weekStart: string }>;
        closedPeriodsFromApi.forEach((p) => {
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

  function changeWeekStart(value: string) {
    setWeekStart(value);
    setWeekEnd(weeklyPeriods.find((period) => period.key === value)?.end.toISOString().slice(0, 10) ?? "");
    setGrades({});
    setIsLoading(false);
  }

  function changeExportPeriod(value: string) {
    setExportStart(value);
    setExportEnd(weeklyPeriods.find((period) => period.key === value)?.end.toISOString().slice(0, 10) ?? "");
  }

  function isFuturePeriod(periodKey: string) {
    return periodKey > formatPeriodDate(new Date());
  }

  const isTrimesterAssessment = assessmentType !== "";
  const gradePeriodSelected = isTrimesterAssessment ? Boolean(trimester) : Boolean(weekStart && weekEnd);
  const canImport = Boolean(subject && gradePeriodSelected)
    && (isTrimesterAssessment || !isFuturePeriod(weekStart))
    && !isLoading && !isImporting;

  useEffect(() => {
    if (!subject || !gradePeriodSelected) return;

    if (!isTrimesterAssessment && isFuturePeriod(weekStart)) return;

    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setIsLoading(true); });
    const query = new URLSearchParams({ turmaId: turma.id, subject });
    if (isTrimesterAssessment) {
      query.set("assessmentType", assessmentType);
      query.set("trimester", trimester);
    } else {
      query.set("weekStart", weekStart);
      query.set("weekEnd", weekEnd);
    }
    fetch(`/api/mini-pauta?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as notas.");
        return response.json();
      })
      .then((data: { grades?: Array<{ studentId: string; value: number }>; alreadyRecorded?: boolean }) => {
        if (!cancelled) {
          setGrades(Object.fromEntries((data.grades ?? []).map((grade) => [grade.studentId, String(grade.value)])));
          if (data.alreadyRecorded || (data.grades ?? []).length > 0) {
            setStatus("Já existem notas para esta avaliação. Pode atualizar os valores; outros tipos e registos existentes serão preservados.");
          } else {
            setStatus("");
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Não foi possível carregar as notas.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentType, gradePeriodSelected, isTrimesterAssessment, subject, trimester, turma.id, weekEnd, weekStart]);

  async function saveGrades() {
    if (!subject || (isTrimesterAssessment ? !trimester : !weekStart || !weekEnd)) {
      setStatus(isTrimesterAssessment ? "Escolha a disciplina e o trimestre da avaliação antes de guardar." : "Escolha a disciplina e o intervalo semanal antes de guardar.");
      return;
    }

    if (!isTrimesterAssessment && isFuturePeriod(weekStart)) {
      setStatus("Não é possível registar notas num período semanal futuro.");
      return;
    }

    const gradeEntries = Object.entries(grades)
      .filter(([, value]) => value.trim() !== "")
      .map(([studentId, value]) => ({ studentId, value: Number(value) }));

    if (assessmentType && !trimester) {
      setStatus("Selecione o trimestre I, II ou III para este tipo de nota.");
      return;
    }

    if (gradeEntries.some((entry) => !Number.isFinite(entry.value) || entry.value < 0 || entry.value > turma.gradeScale)) {
      setStatus(`As notas devem estar entre 0 e ${turma.gradeScale}.`);
      return;
    }

    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/mini-pauta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId: turma.id, subject, ...(isTrimesterAssessment ? {} : { weekStart, weekEnd }), assessmentType: assessmentType || null, trimester: trimester || null, grades: gradeEntries }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível guardar a mini pauta.");
      setStatus(data.saved ? `${data.saved} nota(s) guardada(s) ou atualizada(s). Outros tipos de avaliação e dados existentes foram preservados.` : "Nenhuma nota preenchida. Os registos existentes foram mantidos sem alterações.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar a mini pauta.");
    } finally {
      setIsSaving(false);
    }
  }

  async function importGrades(file: File) {
    setIsImporting(true);
    setStatus("");
    setImportValidationError(null);
    try {
      const result = importMiniPautaGrades(await file.arrayBuffer(), {
        educationType: turma.educationType,
        assessmentType,
        trimester,
        gradeScale: turma.gradeScale,
        roster: turma.roster.map(({ id, name }) => ({ id, name })),
      });
      if (!result.grades.length) {
        setStatus(`Nenhuma nota foi importada da coluna ${result.source}. Verifique os nomes, valores e limites da escala.`);
        return;
      }

      setGrades((current) => ({
        ...current,
        ...Object.fromEntries(result.grades.map(({ studentId, value }) => [studentId, String(value)])),
      }));
      const details = [
        result.unmatched ? `${result.unmatched} aluno(s) sem correspondência` : "",
        result.invalid ? `${result.invalid} valor(es) inválido(s) ou fora da escala` : "",
        result.ambiguous ? `${result.ambiguous} correspondência(s) ambígua(s)` : "",
      ].filter(Boolean);
      setStatus(`${result.grades.length} nota(s) importada(s) de ${result.source}. Revise os valores e clique em “Guardar notas” para os registar.${details.length ? ` ${details.join("; ")}.` : ""}`);
    } catch (error) {
      if (error instanceof MiniPautaImportValidationError) {
        setImportValidationError(error);
      } else {
        setStatus(error instanceof Error ? error.message : "Não foi possível ler o ficheiro XLSX.");
      }
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  async function exportGrades() {
    const exportIsTrimesterAssessment = exportAssessmentType !== "";
    if (!exportSubject || (exportIsTrimesterAssessment ? !exportTrimester : !exportStart || !exportEnd)) {
      setExportStatus(exportIsTrimesterAssessment ? "Escolha a disciplina e o trimestre da avaliação." : "Escolha o intervalo semanal e a disciplina.");
      return;
    }

    const start = exportStart ? new Date(`${exportStart}T12:00:00Z`) : null;
    const end = exportEnd ? new Date(`${exportEnd}T12:00:00Z`) : null;
    if (!exportIsTrimesterAssessment && (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start)) {
      setExportStatus("O intervalo selecionado não é válido.");
      return;
    }
    setIsExporting(true);
    setExportStatus("");
    try {
      await assertReportAccess();
      const exportQuery = new URLSearchParams({ export: "true", turmaId: turma.id, subject: exportSubject });
      if (exportIsTrimesterAssessment) {
        exportQuery.set("assessmentType", exportAssessmentType);
        exportQuery.set("trimester", exportTrimester);
      } else {
        exportQuery.set("weekStart", exportStart);
        exportQuery.set("weekEnd", exportEnd);
      }
      const response = await fetch(`/api/mini-pauta?${exportQuery.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as notas.");

      const scores = (data.grades ?? []) as Array<{ studentId: string; value: number }>;
      const students = (data.students ?? turma.roster) as Array<{ id: string; name: string }>;
      const average = scores.length ? scores.reduce((total, score) => total + Number(score.value), 0) / scores.length : 0;
      const scoreByStudent = new Map(scores.map((score) => [score.studentId, Number(score.value)]));
      const reportElement = document.createElement("div");
      reportElement.style.position = "fixed";
      reportElement.style.left = "-9999px";
      reportElement.style.top = "0";
      reportElement.style.width = "794px";
      reportElement.style.padding = "34px";
      reportElement.style.background = "#fff";
      reportElement.style.fontFamily = "Arial, sans-serif";
      reportElement.style.color = "#1f2a2b";
      reportElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #1b3d34;padding-bottom:18px;"><div style="display:flex;align-items:center;gap:15px;"><img src="/school-logo.png" alt="Logo da escola" style="width:68px;height:68px;object-fit:contain;" /><div><div style="color:#1b3d34;font-size:21px;font-weight:800;letter-spacing:.08em;">NEPH RELATORIOS</div><div style="margin-top:6px;color:#60716a;font-size:11px;text-transform:uppercase;letter-spacing:.12em;">Mini pauta</div></div></div><div style="text-align:right;color:#60716a;font-size:11px;"><strong style="display:block;color:#1b3d34;">INTERVALO</strong>${escapeHtml(exportStart)} a ${escapeHtml(exportEnd)}</div></div><div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin:22px 0 26px;"><div style="background:#1b3d34;color:#fff;border-radius:12px;padding:17px 19px;"><span style="display:block;color:#b9d7c4;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;">Disciplina</span><strong style="font-size:20px;">${escapeHtml(exportSubject)}</strong></div><div style="background:#fff7df;border:1px solid #f0dfaa;border-radius:12px;padding:17px 19px;"><span style="display:block;color:#806b2c;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px;">Média aritmética</span><strong style="font-size:25px;color:#6d581e;">${average.toFixed(1)}</strong><span style="display:block;margin-top:4px;color:#806b2c;font-size:10px;">${scores.length} nota(s) considerada(s)</span></div></div><h2 style="color:#1b3d34;font-size:17px;margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Notas por aluno</h2><table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #d8e7dc;border-radius:10px;overflow:hidden;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Aluno</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Nota</th></tr></thead><tbody>${students.map((student, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#fff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(student.name)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:#1b3d34;">${scoreByStudent.has(student.id) ? scoreByStudent.get(student.id)!.toFixed(1) : "Não avaliado"}</td></tr>`).join("")}</tbody></table><div style="margin-top:25px;padding:13px 16px;border-left:4px solid #39755d;border-radius:0 10px 10px 0;background:#f1f7f2;color:#40554c;font-size:11px;">A média aritmética considera apenas as notas registadas para esta disciplina no intervalo seleccionado.</div>`;
      const classificationLabel = exportAssessmentType ? `${exportAssessmentType} · ${exportTrimester} trimestre` : "AC1 · nota normal";
      const classificationHeading = document.createElement("p");
      classificationHeading.textContent = `Classificação: ${classificationLabel}`;
      classificationHeading.style.cssText = "margin:14px 0 0;color:#315746;font-size:13px;font-weight:700;";
      reportElement.insertBefore(classificationHeading, reportElement.firstChild);
      const periodHeading = reportElement.querySelector("strong");
      if (periodHeading) {
        periodHeading.textContent = exportIsTrimesterAssessment ? "TRIMESTRE" : "INTERVALO";
        const periodLabelNode = periodHeading.parentElement?.lastChild;
        if (periodLabelNode) periodLabelNode.textContent = exportIsTrimesterAssessment ? `Trimestre ${exportTrimester}` : `${exportStart} a ${exportEnd}`;
      }
      document.body.appendChild(reportElement);
      const logo = reportElement.querySelector("img");
      if (logo && !logo.complete) await new Promise<void>((resolve) => { logo.addEventListener("load", () => resolve(), { once: true }); logo.addEventListener("error", () => resolve(), { once: true }); });
      const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageWidth = pageWidth - 18;
      const printableHeight = pageHeight - 18;
      const pixelsPerMillimeter = canvas.width / imageWidth;
      const pageSliceHeight = Math.floor(printableHeight * pixelsPerMillimeter);
      let sourceY = 0;
      while (sourceY < canvas.height) {
        const sourceHeight = Math.min(pageSliceHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("Não foi possível preparar uma página do PDF.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
        if (sourceY > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 9, 9, imageWidth, sourceHeight / pixelsPerMillimeter);
        sourceY += sourceHeight;
      }
      pdf.save(`mini-pauta-${exportSubject.toLowerCase().replace(/\s+/g, "-")}-${exportStart}.pdf`);
      reportElement.remove();
      setShowExportModal(false);
      setExportStatus("");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
      <PageHeaderCard
        badge="Avaliação dos alunos"
        title="Mini pauta"
        description={`Registe e acompanhe as notas da turma ${turma.name}.`}
        icon={BookOpen}
        action={<Button variant="outline" size="lg" render={<Link href={`/turmas/${turma.id}`} />}><ArrowLeft /> Voltar à turma</Button>}
      />

      <Card className="shadow-sm">
        <CardHeader><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-5" /></div><div><CardTitle>Detalhes da avaliação</CardTitle><CardDescription className="mt-1">Selecione a disciplina e o período de avaliação.</CardDescription></div></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <GradeSelect id="grade-subject" label="Disciplina" value={subject} onChange={(value) => { setSubject(value); setGrades({}); setIsLoading(false); }} disabled={isSaving || isImporting || !turma.subjects.length} options={turma.subjects.length ? turma.subjects.map((entry) => ({ value: entry, label: entry })) : [{ value: "", label: "Sem disciplinas" }]} />
          {!isTrimesterAssessment && <GradeSelect id="grade-week" label="Período semanal" value={weekStart} onChange={changeWeekStart} disabled={isSaving || isImporting} options={[{ value: "", label: "Selecione um período" }, ...weeklyPeriods.map((period) => {
            const isClosed = closedPeriods.has(period.key);
            const isFuture = isFuturePeriod(period.key);
            return { value: period.key, label: `${period.start.toLocaleDateString("pt-AO")} - ${period.end.toLocaleDateString("pt-AO")}${isFuture ? " (futuro)" : ""}${isClosed ? " (fechado)" : ""}`, disabled: isFuture || isClosed };
          })]} />}
          <GradeSelect id="grade-type" label="Tipo de nota" value={assessmentType} onChange={(value) => { setAssessmentType(value as GradeAssessmentType); if (!value) setTrimester(""); setGrades({}); setIsLoading(false); setStatus(value && !trimester ? "Selecione o trimestre I, II ou III para esta avaliação." : ""); }} disabled={isSaving || isImporting} options={assessmentOptions} />
          <GradeSelect id="grade-trimester" label="Trimestre" value={trimester} onChange={(value) => { setTrimester(value as Trimester); setGrades({}); setIsLoading(false); }} disabled={!assessmentType || isSaving || isImporting} options={[{ value: "", label: assessmentType ? "Selecione" : "Não aplicável · AC1" }, ...["I", "II", "III"].map((value) => ({ value, label: value }))]} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Notas dos alunos · {assessmentType || "AC1"}{assessmentType && trimester ? ` · ${trimester} trimestre` : ""}</p><CardTitle className="mt-1">{subject || "Escolha uma disciplina"}</CardTitle><CardDescription className="mt-1">Introduza notas entre 0 e {turma.gradeScale}.</CardDescription></div></div>
          <Badge variant="secondary" className="w-fit">{isTrimesterAssessment ? trimester ? `${trimester} trimestre` : "Selecione o trimestre" : weekStart && weekEnd ? `${weekStart} a ${weekEnd}` : "Selecione um período"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-5">
          {turma.roster.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {turma.roster.map((student) => (
              <label key={student.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/20 p-4 transition-colors focus-within:border-primary/40 focus-within:bg-primary/5">
                <Avatar className="size-12 shrink-0">{student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={`Fotografia de ${displayName(student.name)}`} />}<AvatarFallback className="bg-primary/10 font-semibold text-primary">{displayName(student.name).charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{displayName(student.name)}</span><span className="text-xs text-muted-foreground">Nota / {turma.gradeScale}</span></span>
                <Input aria-label={`Nota de ${student.name}`} className="h-10 w-20 shrink-0 bg-background text-center" type="number" min="0" max={turma.gradeScale} step="0.1" value={grades[student.id] ?? ""} onChange={(event) => setGrades((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="—" disabled={!gradePeriodSelected || isLoading || isSaving || isImporting} />
              </label>
            ))}
          </div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Não há alunos ativos nesta turma.</div>}
          <div className="flex flex-col gap-4 border-t pt-4 xl:flex-row xl:items-center xl:justify-between">
            <p aria-live="polite" className="text-sm text-muted-foreground">{isLoading ? "A carregar notas..." : isImporting ? "A importar notas..." : `${Object.values(grades).filter((value) => value.trim() !== "").length} de ${turma.roster.length} alunos avaliados`}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="outline" className="h-10" onClick={() => { setExportSubject(subject); setExportAssessmentType(assessmentType); setExportTrimester(trimester); setExportStatus(""); setShowExportModal(true); }}><Download /> Exportar PDF</Button>
              <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importGrades(file); }} />
              <Button type="button" variant="outline" className="h-10" onClick={() => importInputRef.current?.click()} disabled={!canImport || isSaving}><Upload /> {isImporting ? "A importar..." : "Importar XLSX"}</Button>
              <Button type="button" className="h-10" onClick={saveGrades} disabled={isSaving || isLoading || isImporting || !gradePeriodSelected || (!isTrimesterAssessment && isFuturePeriod(weekStart))}><Save /> {isSaving ? "A guardar..." : "Guardar notas"}</Button>
            </div>
          </div>
          {status && <p role="status" className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-foreground">{status}</p>}
        </CardContent>
      </Card>
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerar relatório</DialogTitle><DialogDescription>Exporte a mini pauta em PDF para a avaliação selecionada.</DialogDescription></DialogHeader>
          <DialogCloseButton aria-label="Fechar" />
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void exportGrades(); }}>
            <GradeSelect id="export-subject" label="Disciplina" value={exportSubject} onChange={setExportSubject} disabled={isExporting || !turma.subjects.length} options={turma.subjects.length ? turma.subjects.map((entry) => ({ value: entry, label: entry })) : [{ value: "", label: "Sem disciplinas" }]} />
            <GradeSelect id="export-type" label="Tipo de nota" value={exportAssessmentType} onChange={(value) => { setExportAssessmentType(value as GradeAssessmentType); if (!value) setExportTrimester(""); }} disabled={isExporting} options={assessmentOptions} />
            {exportAssessmentType ? <GradeSelect id="export-trimester" label="Trimestre" value={exportTrimester} onChange={(value) => setExportTrimester(value as Trimester)} disabled={isExporting} options={[{ value: "", label: "Selecione" }, ...["I", "II", "III"].map((value) => ({ value, label: value }))]} /> : <GradeSelect id="export-week" label="Período semanal" value={exportStart} onChange={changeExportPeriod} disabled={isExporting} options={[{ value: "", label: "Selecione um período" }, ...weeklyPeriods.map((period) => {
              const isClosed = closedPeriods.has(period.key);
              return { value: period.key, label: `${period.start.toLocaleDateString("pt-AO")} - ${period.end.toLocaleDateString("pt-AO")}${isClosed ? " (fechado)" : ""}`, disabled: isClosed };
            })]} />}
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">A média será calculada com as notas da classificação e do período selecionados.</p>
            {exportStatus && <p role="alert" className="text-sm text-destructive">{exportStatus}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={isExporting} onClick={() => setShowExportModal(false)}>Cancelar</Button><Button type="submit" disabled={isExporting || Boolean(exportAssessmentType ? !exportTrimester : !exportStart)}><Download /> {isExporting ? "A gerar..." : "Exportar PDF"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(importValidationError)} onOpenChange={(open) => { if (!open) setImportValidationError(null); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader><DialogTitle>Trimestre não corresponde</DialogTitle><DialogDescription>Importação de NPP</DialogDescription></DialogHeader>
          <DialogCloseButton aria-label="Fechar" />
          {importValidationError && <div className="grid gap-3 text-sm">
            <p>{importValidationError.message}</p>
            <p>Trimestre escolhido na mini pauta: <strong>{importValidationError.selectedTrimester}</strong>.</p>
            {importValidationError.latestPopulatedTrimester ? <p>Trimestre mais recente com notas numéricas válidas (0–{turma.gradeScale}): <strong>{importValidationError.latestPopulatedTrimester}</strong>. Foram encontradas notas em {importValidationError.populatedStudentCount} aluno(s) nesse trimestre.</p> : <p>Não foi encontrada nenhuma nota numérica válida (0–{turma.gradeScale}) nas colunas AC1, AC2, NPP ou NPT dos trimestres I, II e III.</p>}
            <p>Folha analisada: <strong>{importValidationError.sheetName}</strong>.</p>
            <p>Para evitar importar NPP do trimestre errado, escolha o trimestre mais recente indicado acima e tente importar novamente. O ficheiro não alterou as notas da mini pauta.</p>
          </div>}
          <DialogFooter><Button type="button" onClick={() => setImportValidationError(null)}><FileSpreadsheet /> Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
