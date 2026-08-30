"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const subjects = ["Matemática", "Português", "Ciências", "História", "Educação Física", "Arte"];
const tempos = Array.from({ length: 6 }, (_, index) => `${index + 1}º tempo`);
const faultTypes = ["Falta de material", "Ausência na sala"];

export function StudentRecordClient({ turma, student }: { turma: { id: string; name: string; schedule: string; students: number }; student: { name: string; age: number; attendance: string } }) {
  const [tab, setTab] = useState<"notas" | "faltas">("notas");
  const [absenceRows, setAbsenceRows] = useState([
    { subject: "Matemática", dia: "2026-08-20", tempo: "1º tempo", faultType: "Falta de material", notes: "Falta justificada" },
  ]);

  const studentSlug = useMemo(
    () => student.name.toLowerCase().replace(/\s+/g, "-") ,
    [student.name],
  );

  function addAbsenceRow() {
    setAbsenceRows((current) => [
      ...current,
      { subject: "Português", dia: "", tempo: "1º tempo", faultType: "Falta de material", notes: "" },
    ]);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>
            AEph <small>REPORTS</small>
          </span>
        </div>

        <nav>
          <Link href="/" className="">
            <span>▦</span> Reports
          </Link>
          <Link href="/turmas" className="nav-active">
            <span>◫</span> Turmas
          </Link>
          <Link href="/#activity" className="">
            <span>↗</span> Activity
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="help-mark">?</div>
          <div>
            <strong>Need a hand?</strong>
            <small>Read the sending guide</small>
          </div>
        </div>
      </aside>

      <div className="page-shell">
        <main className="main-content" style={{ maxWidth: 900 }}>
          <header className="topbar" style={{ marginBottom: "1.75rem" }}>
            <div>
              <p className="eyebrow">ALUNO</p>
              <h1 style={{ fontSize: "2rem", letterSpacing: "-0.05em" }}>{student.name}</h1>
            </div>
            <Link href={`/turmas/${turma.id}`} style={{ textDecoration: "none", color: "#39755d", fontWeight: 800 }}>
              ← Voltar à turma
            </Link>
          </header>

          <section style={{ background: "#fff", border: "1px solid #dfe5df", padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5ece5", paddingBottom: "0.8rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setTab("notas")} style={{ border: tab === "notas" ? "none" : "1px solid #dfe5df", background: tab === "notas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Notas
              </button>
              <button type="button" onClick={() => setTab("faltas")} style={{ border: tab === "faltas" ? "none" : "1px solid #dfe5df", background: tab === "faltas" ? "#eaf5ea" : "#fff", color: "#244d3d", fontWeight: 800, padding: "0.7rem 1rem", cursor: "pointer" }}>
                Faltas
              </button>
            </div>

            {tab === "notas" ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                {subjects.map((subject) => (
                  <div key={subject} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 180px) 1fr", gap: "0.75rem", alignItems: "center", background: "#f7f8f4", border: "1px solid #e3e8e1", padding: "0.75rem 0.9rem" }}>
                    <strong style={{ color: "#32413d" }}>{subject}</strong>
                    <input type="number" min="0" max="20" step="0.1" defaultValue="16.5" placeholder="Inserir nota" style={{ padding: "0.8rem 0.9rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                  </div>
                ))}
                <div style={{ paddingTop: "1rem", borderTop: "1px solid #e5ece5" }}>
                  <button type="button" style={{ padding: "0.9rem 1.2rem", background: "#39755d", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
                    Guardar notas
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {absenceRows.map((row, index) => (
                  <div key={`${row.subject}-${index}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", background: "#f7f8f4", border: "1px solid #e3e8e1", padding: "0.85rem" }}>
                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Disciplina
                      <select value={row.subject} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].subject = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {subjects.map((subject) => (
                          <option key={subject} value={subject}>{subject}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Dia
                      <input type="date" value={row.dia} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].dia = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }} />
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Tempo
                      <select value={row.tempo} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].tempo = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {tempos.map((tempo) => (
                          <option key={tempo} value={tempo}>{tempo}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d" }}>
                      Tipo de falta
                      <select value={row.faultType} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].faultType = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.7rem 0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8" }}>
                        {faultTypes.map((faultType) => (
                          <option key={faultType} value={faultType}>{faultType}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: "0.45rem", fontWeight: 700, color: "#31413d", gridColumn: "1 / -1" }}>
                      Observação
                      <textarea rows={2} value={row.notes} onChange={(event) => {
                        const next = [...absenceRows];
                        next[index].notes = event.target.value;
                        setAbsenceRows(next);
                      }} style={{ padding: "0.8rem", border: "1px solid #ccd7cc", background: "#fbfcf8", resize: "vertical" }} />
                    </label>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <button type="button" onClick={addAbsenceRow} style={{ padding: "0.8rem 1rem", border: "1px solid #dfe5df", background: "#fff", color: "#244d3d", fontWeight: 800, cursor: "pointer" }}>
                    + Adicionar falta
                  </button>
                  <button type="button" style={{ padding: "0.9rem 1.2rem", background: "#39755d", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
                    Guardar faltas
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
