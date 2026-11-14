"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ClipboardList, FileCheck, FileText, GraduationCap, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ContactosTab } from "./contactos-tab";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";
import { makeSchoolWebsiteQrTarget } from "@/lib/school-report-email";

type GradeRecord = { id: string; subject: string; value: number; term: string; assessmentType: "AC2" | "NPP" | "NPT" | null; trimester: "I" | "II" | "III" | null; createdAt: string };
type AbsenceRecord = { id: string; subject: string; dia: string; tempo: string; faultType: string; notes: string; justified: boolean; justificationTitle: string; justificationNotes: string; hasAttachment?: boolean; attachmentName?: string | null; createdAt: string };
type MonthlyStudentSummary = {
  month: string;
  gradeScale: number;
  negativeThreshold: number;
  negativeGradesBySubject: Array<{ subject: string; grades: Array<{ value: number; weekStart: string; weekEnd: string }> }>;
  absencesBySubject: Array<{ subject: string; total: number; justified: number; unjustified: number }>;
};
const tempos = Array.from({ length: 6 }, (_, index) => `${index + 1}º tempo`);

type StudentTab = "resumo" | "notas" | "faltas" | "justificativos" | "relatorio" | "contactos";

function RecordSelect({ label, value, onChange, options, disabled, clearLabel }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string; disabled?: boolean }>; disabled?: boolean; clearLabel?: string }) {
  return (
    <Select value={value || null} onValueChange={(next) => onChange(next === "__clear__" ? "" : next ?? "")} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-10 w-full bg-background">
        <SelectValue placeholder={clearLabel ?? "Selecione uma opção"}>{options.find((option) => option.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {clearLabel && <SelectItem value="__clear__">{clearLabel}</SelectItem>}
        {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PeriodSelector({ value, onChange, periods, isFuture, includeAll = false }: { value: string; onChange: (value: string) => void; periods: ReturnType<typeof getWeeklyCoordinationPeriods>; isFuture: (key: string) => boolean; includeAll?: boolean }) {
  const options = periods.map((period) => ({ value: period.key, label: `${period.start.toLocaleDateString("pt-AO")} - ${period.end.toLocaleDateString("pt-AO")}${isFuture(period.key) ? " (futuro)" : ""}`, disabled: isFuture(period.key) }));
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="size-5" /></span>
        <div><p className="text-sm font-semibold">Período semanal</p><p className="text-xs text-muted-foreground">Selecione o intervalo a consultar</p></div>
      </div>
      <div className="w-full sm:max-w-xs"><RecordSelect label="Período semanal" value={value} onChange={onChange} clearLabel="Selecione um período" options={includeAll ? [{ value: "all", label: "Todos os períodos" }, ...options] : options} /></div>
    </div>
  );
}

function getShortStudentName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function StudentRecordClient({ turma, student, school, nextStudent, initialWeek, canEdit, canAddParent }: { turma: { id: string; name: string; schedule: string; students: number; gradeScale: number; subjects: string[] }; student: { id: string; name: string; age: number; attendance: string; avatarUrl?: string | null; parents: Array<{ id: string; name: string; phone: string; email: string }> }; school: { id: string; name: string; logoUrl: string | null; address: string | null; website: string | null; reportEmailTemplate: string | null }; nextStudent: { id: string; name: string } | null; initialWeek: string; canEdit: boolean; canAddParent: boolean }) {
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const initialReportPeriod = weeklyPeriods.find((period) => period.key === initialWeek);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [tab, setTab] = useState<StudentTab>(initialReportPeriod ? "relatorio" : "resumo");
  const [gradeStart, setGradeStart] = useState("");
  const [gradeEnd, setGradeEnd] = useState("");
  const [summaryStart, setSummaryStart] = useState("");
  const [summaryEnd, setSummaryEnd] = useState("");
  const [reportStart, setReportStart] = useState<string>(initialReportPeriod?.key ?? "");
  const [reportEnd, setReportEnd] = useState<string>(initialReportPeriod ? formatPeriodDate(initialReportPeriod.end) : "");
  const [behavior, setBehavior] = useState("");
  const [absenceStart, setAbsenceStart] = useState("");
  const [absenceEnd, setAbsenceEnd] = useState("");
  const [reportNote, setReportNote] = useState<string>("");
  const [observationLoading, setObservationLoading] = useState(Boolean(initialReportPeriod));
  const [proofreading, setProofreading] = useState(false);
  const [improvedReportNote, setImprovedReportNote] = useState<string | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyStudentSummary | null>(null);
  const [previousMonthlySummary, setPreviousMonthlySummary] = useState<MonthlyStudentSummary | null>(null);
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false);
  const [monthlySummaryError, setMonthlySummaryError] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [justificationStart, setJustificationStart] = useState("");
  const [justificationEnd, setJustificationEnd] = useState("");
  const [selectedAbsenceIds, setSelectedAbsenceIds] = useState<string[]>([]);
  const [justificationTitle, setJustificationTitle] = useState("");
  const [justificationNotes, setJustificationNotes] = useState("");
  const [justificationFile, setJustificationFile] = useState<File | null>(null);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [previewAbsenceId, setPreviewAbsenceId] = useState<string | null>(null);

  function isFuturePeriod(periodKey: string) {
    const period = weeklyPeriods.find((item) => item.key === periodKey);
    if (!period) return false;
    return period.start.getTime() > new Date(`${todayKey}T12:00:00`).getTime();
  }

  function selectJustificationPeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setJustificationStart(value);
    setJustificationEnd(period?.end.toISOString().slice(0, 10) ?? "");
    setSelectedAbsenceIds([]);
  }

  function selectAbsencePeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setAbsenceStart(value);
    setAbsenceEnd(period?.end.toISOString().slice(0, 10) ?? "");
  }

  function selectReportPeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    setReportStart(value);
    setReportEnd(period?.end.toISOString().slice(0, 10) ?? "");
    setImprovedReportNote(null);
    setReportSaved(false);
    setObservationLoading(Boolean(value));
    if (!value) {
      setReportNote("");
      setBehavior("");
    }
  }

  function selectSummaryPeriod(value: string) {
    const period = weeklyPeriods.find((item) => item.key === value);
    if (value === "all") {
      setSummaryStart("all");
      setSummaryEnd(todayKey);
      return;
    }
    setSummaryStart(value);
    setSummaryEnd(period ? formatPeriodDate(period.end) : "");
  }

  useEffect(() => {
    if (tab !== "resumo" && tab !== "notas" && tab !== "faltas" && tab !== "justificativos") return;
    if (tab === "resumo" && (!summaryStart || !summaryEnd)) {
      Promise.resolve().then(() => {
        setGrades([]);
        setAbsences([]);
        setRecordsLoading(false);
      });
      return;
    }
    if (tab === "notas" && (!gradeStart || !gradeEnd)) {
      Promise.resolve().then(() => setGrades([]));
      return;
    }
    if (tab === "justificativos" && (!justificationStart || !justificationEnd)) {
      Promise.resolve().then(() => {
        setAbsences([]);
        setRecordsLoading(false);
      });
      return;
    }
    if (tab === "faltas" && (!absenceStart || !absenceEnd)) {
      Promise.resolve().then(() => {
        setAbsences([]);
        setRecordsLoading(false);
      });
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setRecordsLoading(true); });
    const from = tab === "resumo" ? (summaryStart === "all" ? "2000-01-01" : summaryStart) : tab === "notas" ? gradeStart : tab === "faltas" ? absenceStart : justificationStart;
    const to = tab === "resumo" ? summaryEnd : tab === "notas" ? gradeEnd : tab === "faltas" ? absenceEnd : justificationEnd;
    const term = tab === "notas" || (tab === "resumo" && summaryStart !== "all") ? `Semanal:${from}:${to}` : "";
    const termQuery = term ? `&term=${encodeURIComponent(term)}` : "";
    fetch(`/api/student-record?studentId=${encodeURIComponent(student.id)}&from=${from}&to=${to}${termQuery}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os registos.");
        return response.json();
      })
      .then((data: { grades?: GradeRecord[]; absences?: AbsenceRecord[] }) => {
        if (!cancelled) {
          setGrades(data.grades ?? []);
          setAbsences(data.absences ?? []);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar os registos.");
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });
    return () => { cancelled = true; };
  }, [absenceEnd, absenceStart, gradeEnd, gradeStart, justificationEnd, justificationStart, student.id, summaryEnd, summaryStart, tab, todayKey]);

  useEffect(() => {
    if (tab !== "relatorio" || !reportStart || !reportEnd) {
      return;
    }
    let cancelled = false;
    fetch(`/api/student-observations?studentId=${encodeURIComponent(student.id)}&weekStart=${encodeURIComponent(reportStart)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a observação.");
        return response.json() as Promise<{ observation?: { teacherObservation?: string; behavior?: string } | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setReportNote(data.observation?.teacherObservation ?? "");
          setImprovedReportNote(null);
          setBehavior(data.observation?.behavior ?? "");
          setReportSaved(Boolean(data.observation));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar a observação.");
      })
      .finally(() => {
        if (!cancelled) setObservationLoading(false);
      });
    return () => { cancelled = true; };
  }, [reportEnd, reportStart, student.id, tab]);

  useEffect(() => {
    if (tab !== "relatorio" || !reportStart) return;
    let cancelled = false;
    const month = reportStart.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
    Promise.resolve().then(() => {
      if (!cancelled) {
        setMonthlySummaryLoading(true);
        setMonthlySummaryError("");
      }
    });
    const fetchMonthSummary = async (monthKey: string) => {
      const response = await fetch(`/api/student-monthly-summary?studentId=${encodeURIComponent(student.id)}&month=${encodeURIComponent(monthKey)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o resumo mensal.");
        return data as MonthlyStudentSummary;
    };
    Promise.all([fetchMonthSummary(month), fetchMonthSummary(previousMonth)])
      .then(([current, previous]) => {
        if (!cancelled) {
          setMonthlySummary(current);
          setPreviousMonthlySummary(previous);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMonthlySummary(null);
          setPreviousMonthlySummary(null);
          setMonthlySummaryError(error instanceof Error ? error.message : "Não foi possível carregar o resumo mensal.");
        }
      })
      .finally(() => { if (!cancelled) setMonthlySummaryLoading(false); });
    return () => { cancelled = true; };
  }, [reportStart, student.id, tab]);

  async function justifySelectedAbsences() {
    if (!selectedAbsenceIds.length || !justificationTitle.trim() || !justificationNotes.trim()) {
      throw new Error("Selecione faltas e preencha os dois campos.");
    }
    if (!justificationFile || !justificationFile.type.startsWith("image/")) {
      throw new Error("Carregue uma imagem para o comprovativo.");
    }

    let attachment: { url: string; pathname: string; name: string; contentType: string; size: number } | undefined;
    {
      const uploadData = new FormData();
      uploadData.append("file", justificationFile);
      uploadData.append("absenceIds", JSON.stringify(selectedAbsenceIds));
      const uploadResponse = await fetch("/api/student-justifications/upload", { method: "POST", body: uploadData });
      const blob = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) throw new Error(blob.error ?? "Não foi possível carregar o comprovativo.");
      attachment = {
        url: blob.url,
        pathname: blob.pathname,
        name: justificationFile.name,
        contentType: justificationFile.type,
        size: justificationFile.size,
      };
    }
    const response = await fetch("/api/student-justifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ absenceIds: selectedAbsenceIds, title: justificationTitle, notes: justificationNotes, attachment }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível justificar as faltas.");
    const justifiedIds: string[] = Array.isArray(result.absenceIds) ? result.absenceIds : [];
    setAbsences((current) => current.map((absence) => justifiedIds.includes(absence.id) ? { ...absence, justified: true, justificationTitle: result.title ?? justificationTitle, justificationNotes: result.notes ?? justificationNotes, hasAttachment: result.attachment?.hasAttachment ?? absence.hasAttachment, attachmentName: result.attachment?.name ?? absence.attachmentName } : absence));
    setSelectedAbsenceIds([]);
    setShowJustificationModal(false);
    setJustificationTitle("");
    setJustificationNotes("");
    setJustificationFile(null);
    setStatusMessage(`${result.justified} falta(s) justificadas.`);
  }

  async function updateRecord(type: "grade" | "absence", record: GradeRecord | AbsenceRecord) {
    const body = type === "grade"
      ? { type, id: record.id, value: (record as GradeRecord).value, subject: record.subject, term: (record as GradeRecord).term }
      : { type, id: record.id, subject: record.subject, dia: (record as AbsenceRecord).dia.slice(0, 10), tempo: (record as AbsenceRecord).tempo, faultType: (record as AbsenceRecord).faultType, notes: (record as AbsenceRecord).notes };
    const response = await fetch("/api/student-record", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar o registo.");
  }

  async function saveWeeklyObservation() {
    if (!reportStart || !reportEnd) {
      setStatusMessage("Escolha um período semanal antes de guardar.");
      return;
    }
    const response = await fetch("/api/student-observations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, weekStart: reportStart, weekEnd: reportEnd, teacherObservation: reportNote, behavior }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar a observação.");
    setReportSaved(Boolean(result.saved));
    setStatusMessage(result.saved ? "Observação semanal guardada." : "Observação semanal removida.");
  }

  async function improveWeeklyObservation() {
    if (!reportStart || !reportEnd || !reportNote.trim()) {
      setStatusMessage("Escreva uma observação semanal antes de melhorar o texto.");
      return;
    }
    setProofreading(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/student-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, weekStart: reportStart, weekEnd: reportEnd, text: reportNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível melhorar o texto.");
      setImprovedReportNote(typeof result.text === "string" ? result.text : null);
      setStatusMessage("Sugestão pronta. Reveja-a antes de a aplicar ao relatório.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível melhorar o texto.");
    } finally {
      setProofreading(false);
    }
  }

  async function deleteRecord(type: "grade" | "absence", id: string) {
    const response = await fetch(`/api/student-record?type=${type}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível eliminar o registo.");
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function generatePdfReport() {
    if (!reportStart || !reportEnd) {
      setStatusMessage("Escolha um intervalo de datas antes de exportar o relatório.");
      return;
    }

    const startDate = new Date(`${reportStart}T00:00:00Z`);
    const endDate = new Date(`${reportEnd}T23:59:59.999Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      setStatusMessage("A data inicial não pode ser posterior à data final.");
      return;
    }

    try {
      const response = await fetch(`/api/student-record?studentId=${student.id}&from=${reportStart}&to=${reportEnd}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados do aluno.");
      }

      const payload = await response.json();
      const grades = (Array.isArray(payload.grades) ? payload.grades : []).filter((grade: { assessmentType?: string | null }) => !grade.assessmentType);
      const faults = Array.isArray(payload.absences) ? payload.absences : [];

      const normalizedGrades: Array<{ subject: string; value: number }> = grades.map((grade: { subject: string; value: number | string }) => ({
        subject: grade.subject,
        value: Number(grade.value),
      }));

      const normalizedFaults: Array<{ subject: string; dia: string; tempo: string; faultType: string; justified: boolean; notes: string }> = faults.map((fault: { subject: string; dia: string; tempo: string; faultType: string; justified?: boolean; notes?: string }) => ({
        subject: fault.subject,
        dia: new Date(fault.dia).toISOString().slice(0, 10),
        tempo: fault.tempo,
        faultType: fault.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material",
        justified: fault.justified === true,
        notes: fault.notes ?? "",
      }));

      const qrTarget = makeSchoolWebsiteQrTarget(school.website);
      const schoolQr = qrTarget ? await QRCode.toDataURL(qrTarget, { errorCorrectionLevel: "M", margin: 1, width: 256 }).catch(() => "") : "";
      const schoolLogo = school.logoUrl || (school.id === "legacy-neph-school" ? "/school-logo.png" : "");

      const reportElement = document.createElement("div");
      reportElement.style.position = "fixed";
      reportElement.style.left = "-9999px";
      reportElement.style.top = "0";
      reportElement.style.width = "794px";
      reportElement.style.padding = "32px";
      reportElement.style.background = "#fff";
      reportElement.style.fontFamily = "Arial, sans-serif";
      reportElement.style.color = "#1f2a2b";
      reportElement.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #1b3d34;padding:0 0 20px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:16px;">
            ${schoolLogo ? `<img src="${escapeHtml(schoolLogo)}" alt="Logótipo da escola" style="width:72px;height:72px;object-fit:contain;" />` : ""}
            <div><div style="font-size:22px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1b3d34;">${escapeHtml(school.name)}</div><div style="margin-top:7px;color:#60716a;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Relatório escolar</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;"><div style="text-align:right;color:#60716a;font-size:11px;line-height:1.6;"><strong style="display:block;color:#1b3d34;font-size:12px;">PERÍODO</strong>${escapeHtml(reportStart)} a ${escapeHtml(reportEnd)}</div>${schoolQr ? `<img src="${schoolQr}" alt="Código QR do website da escola" style="width:56px;height:56px;object-fit:contain;" />` : ""}</div>
        </div>
        <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:12px;margin:18px 0 28px;">
          <div style="background:#1b3d34;color:#fff;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#b9d7c4;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Aluno</span><span style="font-size:19px;font-weight:800;">${escapeHtml(student.name)}</span></div>
          <div style="background:#f1f7f2;border:1px solid #d8e7dc;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#5b6d68;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Turma</span><span style="font-size:16px;font-weight:800;color:#1b3d34;">${escapeHtml(turma.name)}</span></div>
          <div style="background:#fff7df;border:1px solid #f0dfaa;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#806b2c;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Média geral</span><span style="font-size:24px;font-weight:800;color:#6d581e;">${normalizedGrades.length ? (normalizedGrades.reduce((total, grade) => total + grade.value, 0) / normalizedGrades.length).toFixed(1) : "0.0"}</span></div>
          <div style="background:#edf4ee;border:1px solid #cfe1d2;border-radius:12px;padding:16px 18px;"><span style="display:block;color:#5b6d68;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:7px;">Comportamento</span><span style="font-size:16px;font-weight:800;color:#1b3d34;">${escapeHtml(behavior || "Não informado")}</span></div>
        </div>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Notas</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d8e7dc;border-radius:10px;margin-top:10px;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Disciplina</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Nota</th></tr></thead><tbody>${normalizedGrades.length ? normalizedGrades.map((grade, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#ffffff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(grade.subject)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:#1b3d34;">${grade.value.toFixed(1)}</td></tr>`).join("") : `<tr><td colspan="2" style="padding:12px;">Sem notas registadas.</td></tr>`}</tbody></table>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Faltas</h2>
        <table style="width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d8e7dc;border-radius:10px;margin-top:10px;"><thead><tr><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Disciplina</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Dia</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Tempo</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Tipo</th><th style="padding:11px 12px;text-align:left;background:#e8f2ea;color:#315746;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Estado</th></tr></thead><tbody>${normalizedFaults.length ? normalizedFaults.map((fault, index) => `<tr style="background:${index % 2 ? "#fbfdfb" : "#ffffff"};"><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.subject)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.dia)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.tempo)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;">${escapeHtml(fault.faultType)}</td><td style="padding:10px 12px;border-top:1px solid #e5eee7;font-weight:800;color:${fault.justified ? "#286044" : "#806b2c"};">${fault.justified ? "Justificada" : "Injustificada"}</td></tr>`).join("") : `<tr><td colspan="5" style="padding:12px;">Sem faltas registadas.</td></tr>`}</tbody></table>
        <h2 style="color:#1b3d34;font-size:17px;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #d8e7dc;">Observação do professor</h2>
        <div style="border-left:4px solid #39755d;border-radius:0 10px 10px 0;background:#f1f7f2;padding:15px 17px;line-height:1.6;color:#40554c;">${escapeHtml(reportNote.trim() || "Sem observação do professor.")}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:26px;background:#1b3d34;border-radius:12px;padding:15px 18px;color:#fff;"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#b9d7c4;">Resumo de assiduidade</span><span style="font-size:16px;font-weight:800;">${normalizedFaults.length} falta(s) registada(s)</span></div>`;
      document.body.appendChild(reportElement);

      try {
        const reportLogo = reportElement.querySelector("img");
        if (reportLogo && !reportLogo.complete) {
          await new Promise<void>((resolve) => {
            reportLogo.addEventListener("load", () => resolve(), { once: true });
            reportLogo.addEventListener("error", () => resolve(), { once: true });
          });
        }
        const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 18;
        const printableHeight = pageHeight - 18;
        const pixelsPerMillimeter = canvas.width / imgWidth;
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
          pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 9, 9, imgWidth, sourceHeight / pixelsPerMillimeter);
          sourceY += sourceHeight;
        }
        pdf.save(`relatorio-${student.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
        setStatusMessage("PDF gerado com sucesso.");
      } catch (error) {
        console.error("PDF generation failed", error);
        setStatusMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
      } finally {
        reportElement.remove();
      }
    } catch (error) {
      console.error("PDF generation failed", error);
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    }
  }

  const ac1Grades = grades.filter((grade) => grade.assessmentType === null);
  const averageGrade = ac1Grades.length ? ac1Grades.reduce((total, grade) => total + Number(grade.value), 0) / ac1Grades.length : 0;
  const justifiedAbsences = absences.filter((absence) => absence.justified).length;
  const subjectAverages = turma.subjects
    .map((subject) => {
      const subjectGrades = ac1Grades.filter((grade) => grade.subject === subject);
      return { subject, average: subjectGrades.length ? subjectGrades.reduce((total, grade) => total + Number(grade.value), 0) / subjectGrades.length : 0, count: subjectGrades.length };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.average - left.average);
  const faultTypeCounts = [
    { label: "Ausência na sala", count: absences.filter((absence) => absence.faultType === "AUSENCIA_NA_SALA").length },
    { label: "Falta de material", count: absences.filter((absence) => absence.faultType === "FALTA_DE_MATERIAL").length },
  ];
  const gradeBands = [
    { label: "0-9", count: ac1Grades.filter((grade) => Number(grade.value) < 10).length },
    { label: "10-13", count: ac1Grades.filter((grade) => Number(grade.value) >= 10 && Number(grade.value) < 14).length },
    { label: "14-17", count: ac1Grades.filter((grade) => Number(grade.value) >= 14 && Number(grade.value) < 18).length },
    { label: "18-20", count: ac1Grades.filter((grade) => Number(grade.value) >= 18).length },
  ];
  const maxSubjectAverage = Math.max(20, ...subjectAverages.map((item) => item.average));
  const maxFaultCount = Math.max(1, ...faultTypeCounts.map((item) => item.count));
  const maxGradeBandCount = Math.max(1, ...gradeBands.map((item) => item.count));
  const shortStudentName = getShortStudentName(student.name);

  return (
    <AppShell active="turmas">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
        <header className="flex flex-col justify-between gap-4 pb-5 sm:flex-row sm:items-end">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Perfil do aluno</p>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{student.name}</h1>
            <p className="text-sm text-muted-foreground">Acompanhe o percurso escolar e os registos do aluno.</p>
          </div>
          <Link href={`/turmas/${turma.id}`} className={buttonVariants({ variant: "outline", size: "lg", className: "w-fit" })}><ArrowLeft /> Voltar à turma</Link>
        </header>

        <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16 ring-4 ring-background sm:size-20">
              {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={`Fotografia de ${shortStudentName}`} />}
              <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">{student.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ficha individual</p>
              <h2 className="break-words text-xl font-semibold tracking-tight">{student.name}</h2>
              <p className="text-sm text-muted-foreground">{turma.name}{student.age ? ` · ${student.age} anos` : ""}</p>
            </div>
            <Badge variant="secondary" className="w-fit"><GraduationCap /> {turma.name}</Badge>
          </CardContent>
        </Card>
        <Tabs value={tab} onValueChange={(value) => { if (value) setTab(value as StudentTab); }} className="gap-5">
          <Card className="shadow-sm">
            <CardContent className="px-3 py-1.5 sm:px-4 sm:py-2">
              <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-2 bg-transparent p-0" aria-label="Secções do aluno">
                <TabsTrigger value="resumo" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><ClipboardList className="size-4 shrink-0" /><span className="min-w-0 break-words">Resumo</span></TabsTrigger>
                <TabsTrigger value="notas" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><BookOpen className="size-4 shrink-0" /><span className="min-w-0 break-words">Notas</span></TabsTrigger>
                <TabsTrigger value="faltas" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><CalendarDays className="size-4 shrink-0" /><span className="min-w-0 break-words">Faltas</span></TabsTrigger>
                <TabsTrigger value="justificativos" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><FileCheck className="size-4 shrink-0" /><span className="min-w-0 break-words">Justificativos</span></TabsTrigger>
                <TabsTrigger value="relatorio" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><FileText className="size-4 shrink-0" /><span className="min-w-0 break-words">Relatório</span></TabsTrigger>
                <TabsTrigger value="contactos" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><Users className="size-4 shrink-0" /><span className="min-w-0 break-words">Contactos</span></TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>
          <Card className="shadow-sm"><CardContent>

            <TabsContent value="resumo">
              <div className="student-summary-view">
                <PeriodSelector value={summaryStart} onChange={selectSummaryPeriod} periods={weeklyPeriods} isFuture={isFuturePeriod} includeAll />
                {!summaryStart || !summaryEnd ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Selecione um período semanal para ver o resumo.</p> : recordsLoading ? <p className="p-4 text-sm text-muted-foreground">A carregar o resumo...</p> : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-1 rounded-xl border border-primary/20 bg-primary/5 p-4"><span className="text-xs font-medium text-muted-foreground">Média AC1</span><strong className="text-3xl font-semibold tracking-tight text-primary">{averageGrade.toFixed(1)}</strong><small className="text-xs text-muted-foreground">em {ac1Grades.length} nota(s) normais</small></div>
                      <div className="grid gap-1 rounded-xl border bg-muted/30 p-4"><span className="text-xs font-medium text-muted-foreground">Faltas registadas</span><strong className="text-3xl font-semibold tracking-tight">{absences.length}</strong><small className="text-xs text-muted-foreground">{justifiedAbsences} justificadas</small></div>
                      <div className="grid gap-1 rounded-xl border bg-muted/30 p-4"><span className="text-xs font-medium text-muted-foreground">Disciplinas avaliadas</span><strong className="text-3xl font-semibold tracking-tight">{subjectAverages.length}</strong><small className="text-xs text-muted-foreground">de {turma.subjects.length} disciplinas</small></div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <section className="grid content-start gap-4 rounded-xl border p-4">
                        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Desempenho</p><h2 className="mt-1 font-semibold">Média por disciplina</h2></div><span className="text-xs text-muted-foreground">0-{turma.gradeScale}</span></div>
                        {subjectAverages.length ? <div className="grid gap-3">{subjectAverages.map((item) => <div className="grid gap-1.5" key={item.subject}><div className="flex justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{item.subject}</span><strong>{item.average.toFixed(1)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.average / maxSubjectAverage) * 100)}%` }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">Ainda não existem notas registadas.</p>}
                      </section>

                      <section className="grid content-start gap-4 rounded-xl border p-4">
                        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Assiduidade</p><h2 className="mt-1 font-semibold">Tipo de falta</h2></div><span className="text-xs text-muted-foreground">{absences.length} total</span></div>
                        {absences.length ? <div className="grid gap-3">{faultTypeCounts.map((item) => <div className="grid gap-1.5" key={item.label}><div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.label}</span><strong>{item.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${(item.count / maxFaultCount) * 100}%` }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">Não existem faltas registadas.</p>}
                        <div className="border-t pt-3 text-sm text-muted-foreground"><strong className="text-primary">{justifiedAbsences}</strong> de {absences.length} falta(s) justificadas</div>
                      </section>

                      <section className="grid gap-4 rounded-xl border p-4 lg:col-span-2">
                        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Distribuição</p><h2 className="mt-1 font-semibold">Faixas de notas</h2></div><span className="text-xs text-muted-foreground">escala 0-{turma.gradeScale}</span></div>
                        {grades.length ? <div className="grid grid-cols-4 gap-4">{gradeBands.map((band) => <div className="grid h-36 grid-rows-[auto_1fr_auto] justify-items-center gap-1 text-xs" key={band.label}><strong>{band.count}</strong><div className="flex h-full w-full max-w-12 items-end overflow-hidden rounded-t-lg bg-muted"><span className="block w-full rounded-t-lg bg-primary/80" style={{ height: `${(band.count / maxGradeBandCount) * 100}%` }} /></div><strong className="text-muted-foreground">{band.label}</strong></div>)}</div> : <p className="text-sm text-muted-foreground">A distribuição aparecerá quando houver notas.</p>}
                      </section>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="notas">
              <div className="student-record-list-panel">
                <PeriodSelector value={gradeStart} onChange={(value) => { const period = weeklyPeriods.find((item) => item.key === value); setGradeStart(value); setGradeEnd(period ? formatPeriodDate(period.end) : ""); }} periods={weeklyPeriods} isFuture={isFuturePeriod} />
                {!gradeStart || !gradeEnd ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Selecione o período semanal para ver as notas.</p> : <>
                <div className="flex flex-wrap items-end justify-between gap-2 py-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Histórico académico</p><h2 className="mt-1 text-lg font-semibold">Notas registadas</h2></div><Badge variant="secondary">{grades.length} registo(s)</Badge></div>
                {recordsLoading ? <p className="p-4 text-sm text-muted-foreground">A carregar notas...</p> : grades.length ? grades.map((grade) => (
                  <div className="grid items-end gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(0,1fr)_auto]" key={grade.id}>
                    <div className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">Disciplina</span><RecordSelect label="Disciplina" disabled={!canEdit} value={grade.subject} onChange={(value) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, subject: value } : item))} options={turma.subjects.map((subject) => ({ value: subject, label: subject }))} /></div>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Nota<Input className="h-10 bg-background" disabled={!canEdit} type="number" min="0" max="20" step="0.1" value={grade.value} onChange={(event) => setGrades((current) => current.map((item) => item.id === grade.id ? { ...item, value: Number(event.target.value) } : item))} /></label>
                    <Badge variant="secondary" className="mb-2 w-fit">{grade.assessmentType ? `${grade.assessmentType} · ${grade.trimester} trimestre` : "AC1 · nota normal"}</Badge>
                    {canEdit && <div className="flex gap-2"><Button type="button" variant="outline" onClick={async () => { try { await updateRecord("grade", grade); setStatusMessage("Nota atualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar a nota."); } }}>Guardar</Button><Button type="button" variant="destructive" onClick={async () => { try { await deleteRecord("grade", grade.id); setGrades((current) => current.filter((item) => item.id !== grade.id)); setStatusMessage("Nota eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a nota."); } }}>Eliminar</Button></div>}
                  </div>
                )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma nota registada.</p>}
                {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
                </>}
              </div>
            </TabsContent>

            <TabsContent value="faltas">
              <div className="student-record-list-panel">
                <PeriodSelector value={absenceStart} onChange={selectAbsencePeriod} periods={weeklyPeriods} isFuture={isFuturePeriod} />
                <div className="flex flex-wrap items-end justify-between gap-2 py-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Histórico de assiduidade</p><h2 className="mt-1 text-lg font-semibold">Faltas registadas</h2></div><Badge variant="secondary">{absences.length} registo(s)</Badge></div>
                {!absenceStart || !absenceEnd ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Selecione o período semanal para ver as faltas.</p> : recordsLoading ? <p className="p-4 text-sm text-muted-foreground">A carregar faltas...</p> : absences.length ? absences.map((absence) => (
                  <div className="grid items-end gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]" key={absence.id}>
                    <div className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">Disciplina</span><RecordSelect label="Disciplina" disabled={!canEdit} value={absence.subject} onChange={(value) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, subject: value } : item))} options={turma.subjects.map((subject) => ({ value: subject, label: subject }))} /></div>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Dia<Input className="h-10 bg-background" disabled={!canEdit} type="date" max={todayKey} value={absence.dia.slice(0, 10)} onChange={(event) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, dia: event.target.value } : item))} /></label>
                    <div className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">Tempo</span><RecordSelect label="Tempo" disabled={!canEdit} value={absence.tempo} onChange={(value) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, tempo: value } : item))} options={tempos.map((tempo) => ({ value: tempo, label: tempo }))} /></div>
                    <div className="grid gap-1.5"><span className="text-xs font-medium text-muted-foreground">Tipo</span><RecordSelect label="Tipo de falta" disabled={!canEdit} value={absence.faultType} onChange={(value) => setAbsences((current) => current.map((item) => item.id === absence.id ? { ...item, faultType: value } : item))} options={[{ value: "FALTA_DE_MATERIAL", label: "Falta de material" }, { value: "AUSENCIA_NA_SALA", label: "Ausência na sala" }]} /></div>
                    {canEdit && <div className="flex gap-2"><Button type="button" variant="outline" onClick={async () => { try { await updateRecord("absence", absence); setStatusMessage("Falta atualizada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar a falta."); } }}>Guardar</Button><Button type="button" variant="destructive" onClick={async () => { try { await deleteRecord("absence", absence.id); setAbsences((current) => current.filter((item) => item.id !== absence.id)); setStatusMessage("Falta eliminada."); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível eliminar a falta."); } }}>Eliminar</Button></div>}
                  </div>
                )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma falta registada.</p>}
                {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
              </div>
            </TabsContent>

            <TabsContent value="justificativos">
              <div className="student-record-list-panel">
                <PeriodSelector value={justificationStart} onChange={selectJustificationPeriod} periods={weeklyPeriods} isFuture={isFuturePeriod} />
                {!justificationStart || !justificationEnd ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Selecione o intervalo para ver as faltas.</p> : recordsLoading ? <p className="p-4 text-sm text-muted-foreground">A carregar faltas...</p> : (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-2 py-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Justificação de faltas</p><h2 className="mt-1 text-lg font-semibold">Selecione as faltas</h2></div><Badge variant="secondary">{absences.filter((absence) => !absence.justified).length} por justificar</Badge></div>
                    {absences.length ? absences.map((absence) => (
                      <div key={absence.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4">
                        <Checkbox aria-label={`Selecionar falta de ${absence.subject}, ${absence.dia.slice(0, 10)}, ${absence.tempo}`} checked={selectedAbsenceIds.includes(absence.id)} disabled={!canEdit || absence.justified} onCheckedChange={(checked) => setSelectedAbsenceIds((current) => checked ? [...current.filter((id) => id !== absence.id), absence.id] : current.filter((id) => id !== absence.id))} />
                        <div className="min-w-0 flex-1"><p className="font-semibold">{absence.subject}</p><p className="break-words text-xs text-muted-foreground">{absence.dia.slice(0, 10)} · {absence.tempo} · {absence.faultType === "AUSENCIA_NA_SALA" ? "Ausência na sala" : "Falta de material"}</p></div>
                        <Badge variant={absence.justified ? "secondary" : "outline"}>{absence.justified ? "Justificada" : "Injustificada"}</Badge>
                        {absence.justified && absence.hasAttachment && <Button type="button" variant="outline" size="sm" onClick={() => setPreviewAbsenceId(absence.id)}>Ver comprovativo</Button>}
                      </div>
                    )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma falta neste intervalo.</p>}
                    {canEdit && <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-muted-foreground">{selectedAbsenceIds.length} falta(s) selecionada(s)</span><Button type="button" disabled={!selectedAbsenceIds.length} onClick={() => { setStatusMessage(""); setShowJustificationModal(true); }}>Justificar</Button></div>}
                  </>
                )}
                {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
              </div>
            </TabsContent>

            <TabsContent value="relatorio">
              <div className="grid gap-4">
                <PeriodSelector value={reportStart} onChange={selectReportPeriod} periods={weeklyPeriods} isFuture={isFuturePeriod} />

                {reportStart && (
                  <section className="grid gap-4 rounded-xl border p-4" aria-live="polite">
                    <header className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Comparação mensal</p>
                      <h2 className="font-semibold">Resultados do mês e do mês anterior</h2>
                      <p className="text-sm text-muted-foreground">Notas negativas das semanas iniciadas em cada mês e faltas registadas durante o mês.</p>
                    </header>
                    {monthlySummaryLoading || (monthlySummary && monthlySummary.month !== reportStart.slice(0, 7)) ? <p className="text-sm text-muted-foreground">A carregar resumo mensal...</p> : monthlySummaryError ? <p className="text-sm text-destructive" role="alert">{monthlySummaryError}</p> : monthlySummary && previousMonthlySummary ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {[
                          { summary: previousMonthlySummary, role: "Mês anterior" },
                          { summary: monthlySummary, role: "Mês selecionado" },
                        ].map(({ summary, role }) => (
                          <article className="min-w-0 rounded-xl border bg-muted/30 p-4" key={summary.month}>
                            <h3 className="mb-4 flex flex-wrap items-baseline gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-primary">{role}</span><strong className="text-sm capitalize">{new Date(`${summary.month}-01T12:00:00Z`).toLocaleDateString("pt-AO", { month: "long", year: "numeric", timeZone: "UTC" })}</strong></h3>
                            <div className="grid gap-4 text-sm">
                              <section>
                                <h4 className="mb-2 font-semibold">Notas negativas <small className="font-normal text-muted-foreground">(abaixo de {summary.negativeThreshold})</small></h4>
                                {summary.negativeGradesBySubject.length ? <ul className="grid gap-2">{summary.negativeGradesBySubject.map((entry) => <li className="grid gap-0.5 border-b pb-2 last:border-0 last:pb-0" key={entry.subject}><strong>{entry.subject}</strong><span className="text-xs text-muted-foreground">{entry.grades.map((grade) => `${grade.value} (${grade.weekStart.slice(8, 10)}/${grade.weekStart.slice(5, 7)}–${grade.weekEnd.slice(8, 10)}/${grade.weekEnd.slice(5, 7)})`).join(", ")}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">Nenhuma nota negativa registada.</p>}
                              </section>
                              <section>
                                <h4 className="mb-2 font-semibold">Faltas por disciplina</h4>
                                {summary.absencesBySubject.length ? <ul className="grid gap-2">{summary.absencesBySubject.map((entry) => <li className="grid gap-0.5 border-b pb-2 last:border-0 last:pb-0" key={entry.subject}><strong>{entry.subject}</strong><span className="text-xs text-muted-foreground">{entry.total} falta(s) · {entry.unjustified} injustificada(s) · {entry.justified} justificada(s)</span></li>)}</ul> : <p className="text-xs text-muted-foreground">Nenhuma falta registada.</p>}
                              </section>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )}

                <div className="grid gap-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Observação do professor
                    <Textarea
                      rows={4}
                      maxLength={300}
                      disabled={!canEdit || observationLoading || proofreading}
                      value={reportNote}
                      onChange={(event) => { setReportNote(event.target.value.slice(0, 300)); setReportSaved(false); setImprovedReportNote(null); }}
                      placeholder="Escreva uma observação de até 300 caracteres"
                      className="resize-y"
                    />
                  </label>
                  <div className="text-xs text-muted-foreground">
                    {reportNote.length}/300 caracteres
                  </div>
                </div>

                <div className="grid gap-2 text-sm font-medium"><span>Comportamento</span><RecordSelect label="Comportamento" disabled={!canEdit || observationLoading} value={behavior} onChange={(value) => { setBehavior(value); setReportSaved(false); }} clearLabel="Selecione uma opção" options={[{ value: "Muito bom", label: "Muito bom" }, { value: "Bom", label: "Bom" }, { value: "Razoavel", label: "Razoável" }, { value: "Mau", label: "Mau" }]} /></div>

                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={improveWeeklyObservation} disabled={!canEdit || !reportStart || !reportEnd || !reportNote.trim() || observationLoading || proofreading}><Sparkles /> {proofreading ? "A melhorar..." : "Melhorar o texto"}</Button>
                    <Button type="button" onClick={async () => { try { await saveWeeklyObservation(); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível guardar a observação."); } }} disabled={!canEdit || !reportStart || !reportEnd || observationLoading || proofreading}>
                      {observationLoading ? "A carregar..." : "Guardar observação semanal"}
                    </Button>
                    <Button type="button" variant="outline" onClick={generatePdfReport} disabled={!reportStart || !reportEnd || observationLoading}><FileText /> Exportar PDF</Button>
                  </div>
                  {improvedReportNote !== null && <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><strong>Sugestão revista</strong><p className="whitespace-pre-wrap text-sm">{improvedReportNote}</p><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { setReportNote(improvedReportNote); setImprovedReportNote(null); setReportSaved(false); setStatusMessage("Sugestão aplicada. Guarde a observação para a guardar."); }}>Aplicar sugestão</Button><Button type="button" variant="outline" onClick={() => setImprovedReportNote(null)}>Descartar</Button></div></div>}
                  {reportSaved && nextStudent && <Link className={buttonVariants({ variant: "secondary", className: "w-fit" })} href={`/turmas/${turma.id}/${encodeURIComponent(nextStudent.id)}?week=${encodeURIComponent(reportStart)}`}>Próximo estudante: {nextStudent.name} <ArrowRight /></Link>}
                  {statusMessage ? (
                    <div role="status" className="text-sm font-medium text-primary">{statusMessage}</div>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contactos">
              <ContactosTab parents={student.parents} turmaId={turma.id} studentId={student.id} canAddParent={canAddParent} />
            </TabsContent>
          </CardContent></Card>
        </Tabs>
          <Dialog open={showJustificationModal} onOpenChange={setShowJustificationModal}>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
              <DialogHeader><DialogTitle>Justificar faltas</DialogTitle><DialogDescription>Preencha os detalhes e carregue uma imagem do comprovativo.</DialogDescription></DialogHeader>
              <DialogCloseButton aria-label="Fechar" />
              <form className="grid gap-4" onSubmit={async (event) => { event.preventDefault(); try { await justifySelectedAbsences(); } catch (error) { setStatusMessage(error instanceof Error ? error.message : "Não foi possível justificar as faltas."); } }}>
                <label className="grid gap-2 text-sm font-medium">Título do justificativo<Input required value={justificationTitle} onChange={(event) => setJustificationTitle(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-medium">Observações<Textarea required rows={4} value={justificationNotes} onChange={(event) => setJustificationNotes(event.target.value)} /></label>
                <label className="grid gap-2 text-sm font-medium">Comprovativo<Input type="file" accept="image/*" onChange={(event) => setJustificationFile(event.target.files?.[0] ?? null)} /></label>
                {statusMessage && <p role="alert" className="text-sm text-destructive">{statusMessage}</p>}
                <DialogFooter><Button type="button" variant="outline" onClick={() => setShowJustificationModal(false)}>Cancelar</Button><Button type="submit" disabled={!justificationFile || !justificationFile.type.startsWith("image/")}>Confirmar justificativo</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={Boolean(previewAbsenceId)} onOpenChange={(open) => { if (!open) setPreviewAbsenceId(null); }}>
            <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto">
              <DialogHeader><DialogTitle>Comprovativo da falta</DialogTitle></DialogHeader>
              <DialogCloseButton aria-label="Fechar" />
              {/* Authenticated attachments are served directly by the application. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previewAbsenceId && <img className="mx-auto max-h-[75vh] max-w-full object-contain" src={`/api/student-justifications/${previewAbsenceId}/attachment`} alt="Comprovativo da falta" />}
            </DialogContent>
          </Dialog>
        </main>
      </AppShell>
    );
  }
