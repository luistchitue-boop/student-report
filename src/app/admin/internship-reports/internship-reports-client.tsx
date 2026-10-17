"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./internship-reports.module.css";

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

export function InternshipReportsAdminClient() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [bulkTurmaId, setBulkTurmaId] = useState("");
  const [bulkPeriodKey, setBulkPeriodKey] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [bulkResults, setBulkResults] = useState<Array<{ studentName: string; parentName: string; success: boolean; error?: string }>>([]);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/internship-reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os relatórios de estágio.");
      const loadedTurmas: Turma[] = data.turmas;
      const loadedStudents: Student[] = data.students;
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
      setMessage("");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os relatórios de estágio.");
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch("/api/admin/internship-reports", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os relatórios de estágio.");
        const loadedTurmas: Turma[] = data.turmas;
        const loadedStudents: Student[] = data.students;
        const firstStudent = loadedStudents.find((student) => student.internshipPerformanceReports.length > 0) ?? loadedStudents[0];
        const firstTurmaId = loadedTurmas[0]?.id ?? "";
        const firstTurmaReport = loadedStudents.filter((student) => student.turma.id === firstTurmaId).flatMap((student) => student.internshipPerformanceReports)[0];
        setTurmas(loadedTurmas);
        setStudents(loadedStudents);
        setBulkTurmaId(firstTurmaId);
        setBulkPeriodKey(firstTurmaReport ? `${firstTurmaReport.periodStart.slice(0, 10)}|${firstTurmaReport.periodEnd.slice(0, 10)}` : "");
        setSelectedStudentId(firstStudent?.id ?? "");
        setSelectedReportId(firstStudent?.internshipPerformanceReports[0]?.id ?? "");
        setSelectedParentId(firstStudent?.parents[0]?.id ?? "");
        setLoading(false);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar os relatórios de estágio.");
        setMessageIsError(true);
        setLoading(false);
      });
  }, []);

  const selectedStudent = useMemo(() => students.find((student) => student.id === selectedStudentId), [students, selectedStudentId]);
  const selectedReport = selectedStudent?.internshipPerformanceReports.find((report) => report.id === selectedReportId);
  const selectedParent = selectedStudent?.parents.find((parent) => parent.id === selectedParentId);
  const pdfUrl = selectedReport ? `/api/admin/internship-reports/pdf?reportId=${encodeURIComponent(selectedReport.id)}` : "";
  const internshipTurmas = turmas;
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

  function selectStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    setSelectedStudentId(studentId);
    setSelectedReportId(student?.internshipPerformanceReports[0]?.id ?? "");
    setSelectedParentId(student?.parents[0]?.id ?? "");
    setMessage("");
  }

  async function sendReport() {
    if (!selectedReport || !selectedParent) return;
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
      setMessage(`Relatório enviado para ${selectedParent.name}. O estado inicial é “aceite para envio”; a confirmação por e-mail pode demorar alguns instantes.`);
    } catch (error) {
      await load(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o relatório.");
      setMessageIsError(true);
    } finally {
      setSending(false);
    }
  }

  async function sendTurmaReports() {
    if (!bulkTurmaId || !bulkPeriodKey || !matchingBulkReports.length || bulkSending) return;
    const turmaName = internshipTurmas.find((turma) => turma.id === bulkTurmaId)?.name ?? "turma";
    const confirmed = window.confirm(`Enviar ${bulkPeriodKey.replace("|", " a ")} dos ${matchingBulkReports.length} aluno(s) com relatório na turma ${turmaName} a ${bulkRecipientCount} encarregado(s) por ${channel === "EMAIL" ? "e-mail" : "WhatsApp"}?`);
    if (!confirmed) return;

    setBulkSending(true);
    setBulkResults([]);
    setBulkProgress(`A preparar ${bulkRecipientCount} envio(s)...`);
    setMessage("");
    setMessageIsError(false);
    const results: Array<{ studentName: string; parentName: string; success: boolean; error?: string }> = [];
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

  const currentDeliveries = selectedReport?.deliveries ?? [];

  return (
    <section>
      <p className={styles.intro}>Reveja os relatórios submetidos pelos coordenadores, descarregue o PDF ou envie-o a um encarregado. Este fluxo é separado dos relatórios escolares e regista cada tentativa de envio.</p>
      {loading ? <p className={styles.loading}>A carregar os relatórios de estágio...</p> : internshipTurmas.length === 0 ? (
        <div className={styles.card}><h2>Sem turmas de estágio</h2><p className={styles.sendIntro}>Marque primeiro uma turma como turma de estágio e atribua alunos na configuração de estágio.</p></div>
      ) : (
        <>
          <section className={styles.bulkCard}>
            <div><h2>Envio em massa por turma</h2><p className={styles.sendIntro}>Selecione uma turma marcada para estágio e um período. Para cada aluno ativo com relatório nesse período, será enviado o relatório atualizado mais recentemente aos encarregados que tenham contacto para o canal escolhido.</p></div>
            <div className={styles.bulkControls}>
              <label className={styles.field}>Turma de estágio
                <select value={bulkTurmaId} onChange={(event) => {
                  const nextTurmaId = event.target.value;
                  const nextReport = students.filter((student) => student.turma.id === nextTurmaId).flatMap((student) => student.internshipPerformanceReports)[0];
                  setBulkTurmaId(nextTurmaId);
                  setBulkPeriodKey(nextReport ? `${nextReport.periodStart.slice(0, 10)}|${nextReport.periodEnd.slice(0, 10)}` : "");
                  setBulkResults([]);
                  setMessage("");
                }}>
                  {internshipTurmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
                </select>
              </label>
              <label className={styles.field}>Período do relatório
                <select value={bulkPeriodKey} onChange={(event) => { setBulkPeriodKey(event.target.value); setBulkResults([]); setMessage(""); }} disabled={!bulkPeriods.length}>
                  {!bulkPeriods.length && <option value="">Sem relatórios disponíveis</option>}
                  {bulkPeriods.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
                </select>
              </label>
              <label className={styles.field}>Canal de envio
                <select value={channel} onChange={(event) => setChannel(event.target.value as "EMAIL" | "WHATSAPP")}>
                  <option value="EMAIL">E-mail (PDF em anexo)</option>
                  <option value="WHATSAPP">WhatsApp (PDF como documento)</option>
                </select>
              </label>
              <div className={styles.bulkSummary}>
                <strong>{matchingBulkReports.length} aluno(s)</strong>
                <span>com relatório · {bulkRecipientCount} contacto(s) utilizável(is)</span>
              </div>
              <button className={styles.sendButton} type="button" onClick={sendTurmaReports} disabled={bulkSending || !matchingBulkReports.length || !bulkRecipientCount}>
                {bulkSending ? "A enviar turma..." : `Enviar relatórios da turma (${bulkRecipientCount})`}
              </button>
            </div>
            {bulkProgress && <p className={styles.sendIntro} role="status">{bulkProgress}</p>}
            {message && <p className={`${styles.notice} ${messageIsError ? styles.error : ""}`} role="status">{message}</p>}
            {bulkResults.length > 0 && <div className={styles.bulkResults}>
              {bulkResults.map((result, index) => <div key={`${result.studentName}-${result.parentName}-${index}`}><span>{result.success ? "✓" : "!"} {result.studentName} · {result.parentName}</span>{result.error && <small>{result.error}</small>}</div>)}
            </div>}
          </section>

          <div className={styles.toolbar}>
            <label className={styles.field}>Aluno
              <select value={selectedStudentId} onChange={(event) => selectStudent(event.target.value)}>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.turma.name}{student.active ? "" : " · Inativo"}</option>)}
              </select>
            </label>
            <label className={styles.field}>Relatório de estágio
              <select value={selectedReport?.id ?? ""} onChange={(event) => { setSelectedReportId(event.target.value); setMessage(""); }} disabled={!selectedStudent?.internshipPerformanceReports.length}>
                {!selectedStudent?.internshipPerformanceReports.length && <option value="">Ainda sem relatórios</option>}
                {selectedStudent?.internshipPerformanceReports.map((report) => <option key={report.id} value={report.id}>{report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)} · {report.performanceRating}/5</option>)}
              </select>
            </label>
            <p className={styles.toolbarNote}>Os relatórios são criados pelos coordenadores atribuídos; esta área permite apenas rever, exportar e enviar.</p>
          </div>

          <div className={styles.grid}>
            <section className={styles.card}>
              <h2>Pré-visualização do relatório</h2>
              {selectedReport ? (
                <>
                  <p className={styles.reportMeta}>{selectedStudent?.name} · {selectedStudent?.turma.name}<br />{selectedReport.companyName || "Empresa não indicada"} · Avaliação {selectedReport.performanceRating}/5 · {selectedReport.teacher?.name ?? "Coordenador não indicado"}</p>
                  <div className={styles.actions}>
                    <a className={`${styles.actionLink} ${styles.secondary}`} href={`${pdfUrl}&download=1`}>Descarregar PDF</a>
                    <a className={styles.actionLink} href={pdfUrl} target="_blank" rel="noreferrer">Abrir PDF</a>
                  </div>
                  <iframe className={styles.preview} src={pdfUrl} title={`Pré-visualização do relatório de estágio de ${selectedStudent?.name}`} />
                </>
              ) : <div className={styles.emptyPreview}>Este aluno ainda não tem um relatório de estágio registado.</div>}
            </section>

            <section className={styles.card}>
              <h2>Enviar ao encarregado</h2>
              <p className={styles.sendIntro}>O endereço ou número é obtido dos contactos registados para o aluno. O envio é individual; confirme o destinatário antes de enviar.</p>
              <div className={styles.sendForm} style={{ marginTop: 16 }}>
                <label className={styles.field}>Encarregado
                  <select value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)} disabled={!selectedStudent?.parents.length}>
                    {!selectedStudent?.parents.length && <option value="">Sem contactos registados</option>}
                    {selectedStudent?.parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name} · {parent.email || parent.phone || "Sem contacto"}</option>)}
                  </select>
                </label>
                <label className={styles.field}>Canal
                  <select value={channel} onChange={(event) => setChannel(event.target.value as "EMAIL" | "WHATSAPP")}>
                    <option value="EMAIL">E-mail (PDF em anexo)</option>
                    <option value="WHATSAPP">WhatsApp (PDF como documento)</option>
                  </select>
                </label>
                {selectedParent && <p className={styles.sendIntro}>Destino: {channel === "EMAIL" ? (selectedParent.email || "Sem e-mail registado") : (selectedParent.phone || "Sem telefone registado")}</p>}
                <button className={styles.sendButton} type="button" onClick={sendReport} disabled={sending || !selectedReport || !selectedParent || (channel === "EMAIL" ? !selectedParent.email : !selectedParent.phone)}>
                  {sending ? "A enviar..." : "Enviar relatório"}
                </button>
              </div>
              {message && <p className={`${styles.notice} ${messageIsError ? styles.error : ""}`} role="status">{message}</p>}

              <div className={styles.history}>
                <div className={styles.historyHeading}><h3>Histórico de envios</h3></div>
                {!currentDeliveries.length ? <p className={styles.sendIntro}>Ainda não existem envios para este relatório.</p> : (
                  <div className={styles.deliveryList}>
                    {currentDeliveries.map((delivery) => (
                      <article className={styles.delivery} key={delivery.id}>
                        <div><strong>{delivery.recipientName} · {delivery.recipientContact}</strong><small>{delivery.channel === "EMAIL" ? "E-mail" : "WhatsApp"} · {formatAttempt(delivery.attemptedAt)}{delivery.error ? ` · ${delivery.error}` : ""}</small></div>
                        <span className={styles.status}>{deliveryStatus[delivery.status]}</span>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
