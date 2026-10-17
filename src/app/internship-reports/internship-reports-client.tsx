"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./internship-reports.module.css";

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
    const response = await fetch("/api/internship-reports");
    const data = await response.json();
    if (response.ok) {
      setStudents(data.students);
      setSelectedId((current) => data.students.some((student: Student) => student.id === current) ? current : data.students[0]?.id ?? "");
    } else setMessage(data.error ?? "Não foi possível carregar os alunos atribuídos.");
    setLoading(false);
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
    setSaving(false);
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.studentPanel}>
        <div className={styles.panelHeading}><p className="eyebrow">ALUNOS ATRIBUÍDOS</p><strong>{students.length}</strong></div>
        <input className={styles.search} type="search" placeholder="Pesquisar aluno ou turma" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Pesquisar alunos" />
        {loading ? <p className={styles.empty}>A carregar...</p> : filteredStudents.length ? (
          <div className={styles.studentList}>
            {filteredStudents.map((student) => (
              <button key={student.id} type="button" className={`${styles.studentButton} ${selectedId === student.id ? styles.selected : ""}`} onClick={() => { setSelectedId(student.id); setForm(emptyForm()); setMessage(""); }}>
                <span className={styles.avatar}>{student.avatarUrl ? <Image src={student.avatarUrl} alt="" width={38} height={38} unoptimized /> : student.name.slice(0, 1).toUpperCase()}</span>
                <span className={styles.studentInfo}><strong>{student.name}</strong><small>{student.turma.name}{student.active ? "" : " · Inativo"}</small></span>
                <span className={styles.reportCount}>{student.internshipPerformanceReports.length}</span>
              </button>
            ))}
          </div>
        ) : <p className={styles.empty}>{students.length ? "Nenhum resultado." : "Ainda não tem alunos de estágio atribuídos."}</p>}
      </aside>

      <section className={styles.reportPanel}>
        {!selectedStudent ? <div className={styles.welcome}><span>↗</span><h2>Relatórios de estágio</h2><p>Os alunos atribuídos aparecerão aqui. Só terá acesso aos alunos selecionados pela administração.</p></div> : (
          <>
            <header className={styles.studentHeader}>
              <div><p className="eyebrow">{selectedStudent.turma.name} · ACOMPANHAMENTO INDIVIDUAL</p><h2>{selectedStudent.name}</h2><p>Registe a avaliação da experiência profissional neste período.</p></div>
              <span className={styles.badge}>Estágio</span>
            </header>

            {selectedStudent.internshipPerformanceReports.length > 0 && (
              <section className={styles.history}>
                <div className={styles.historyHeading}><h3>Relatórios anteriores</h3><button type="button" onClick={startNewReport}>Novo relatório</button></div>
                <div className={styles.historyList}>
                  {selectedStudent.internshipPerformanceReports.map((report) => (
                    <button key={report.id} type="button" className={styles.historyItem} onClick={() => editReport(report)}>
                      <span><strong>{report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)}</strong><small>{report.companyName || "Empresa não indicada"}</small></span>
                      <span className={styles.rating}>{report.performanceRating}/5</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <form className={styles.form} onSubmit={saveReport}>
              <div className={styles.formTitle}><h3>Avaliação de desempenho</h3><span>Os relatórios são privados aos coordenadores atribuídos e à administração.</span></div>
              <div className={styles.fieldsTwo}>
                <label>Data inicial<input type="date" required value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /></label>
                <label>Data final<input type="date" required min={form.periodStart} value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /></label>
                <label>Empresa de acolhimento<input maxLength={160} value={form.companyName ?? ""} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Nome da empresa" /></label>
                <label>Função / área de trabalho<input maxLength={160} value={form.position ?? ""} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Ex.: Técnico de informática" /></label>
              </div>
              <label className={styles.ratingField}>Avaliação global <span className={styles.ratingScale}>1 · Insuficiente&nbsp;&nbsp; 3 · Adequado&nbsp;&nbsp; 5 · Excelente</span>
                <select value={form.performanceRating} onChange={(event) => setForm({ ...form, performanceRating: Number(event.target.value) })}>
                  {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                </select>
              </label>
              <div className={styles.fieldsTwo}>
                <label>Pontos fortes<textarea required maxLength={3000} rows={4} value={form.strengths} onChange={(event) => setForm({ ...form, strengths: event.target.value })} placeholder="Competências e atitudes positivas observadas" /></label>
                <label>Aspetos a desenvolver<textarea required maxLength={3000} rows={4} value={form.improvementAreas} onChange={(event) => setForm({ ...form, improvementAreas: event.target.value })} placeholder="Competências que podem ser reforçadas" /></label>
              </div>
              <label>Observações e recomendações<textarea required maxLength={4000} rows={5} value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} placeholder="Descreva o desempenho do aluno e recomendações para o acompanhamento" /></label>
              <div className={styles.formFooter}><p role="status">{message}</p><button type="submit" disabled={saving}>{saving ? "A guardar..." : "Guardar relatório"}</button></div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
