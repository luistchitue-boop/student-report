"use client";

import { useEffect, useMemo, useState } from "react";

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

  async function load() {
    setLoading(true);
    const response = await fetch("/api/admin/internships");
    const data = await response.json();
    if (response.ok) {
      setTurmas(data.turmas);
      setCoordinators(data.coordinators);
      setSelectedTurmaId((current) => data.turmas.some((turma: Turma) => turma.id === current) ? current : data.turmas[0]?.id ?? "");
      setAssignments(Object.fromEntries(data.turmas.flatMap((turma: Turma) => turma.students.map((student) => [student.id, student.teacherIds]))));
    } else setMessage(data.error ?? "Não foi possível carregar as turmas.");
    setLoading(false);
  }

  useEffect(() => {
    void fetch("/api/admin/internships")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok) {
          setTurmas(data.turmas);
          setCoordinators(data.coordinators);
          setSelectedTurmaId(data.turmas[0]?.id ?? "");
          setAssignments(Object.fromEntries(data.turmas.flatMap((turma: Turma) => turma.students.map((student) => [student.id, student.teacherIds]))));
        } else setMessage(data.error ?? "Não foi possível carregar as turmas.");
        setLoading(false);
      })
      .catch(() => {
        setMessage("Não foi possível carregar as turmas.");
        setLoading(false);
      });
  }, []);

  const selectedTurma = useMemo(() => turmas.find((turma) => turma.id === selectedTurmaId), [turmas, selectedTurmaId]);

  async function updateMode(isInternship: boolean) {
    if (!selectedTurma) return;
    setBusy("mode");
    setMessage("");
    const response = await fetch("/api/admin/internships", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setTurmaMode", turmaId: selectedTurma.id, isInternship }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.error ?? "Não foi possível atualizar a turma.");
    else {
      setTurmas((current) => current.map((turma) => turma.id === selectedTurma.id ? { ...turma, isInternship } : turma));
      setMessage(isInternship ? "Turma ativada para relatórios de estágio." : "Modo estágio desativado. As atribuições e relatórios foram preservados.");
    }
    setBusy("");
  }

  async function saveStudent(student: Student) {
    setBusy(student.id);
    setMessage("");
    const response = await fetch("/api/admin/internships", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setStudentAssignments", turmaId: selectedTurmaId, studentId: student.id, teacherIds: assignments[student.id] ?? [] }),
    });
    const data = await response.json();
    setMessage(response.ok ? `Atribuições de ${student.name} guardadas.` : data.error ?? "Não foi possível guardar as atribuições.");
    if (response.ok) await load();
    setBusy("");
  }

  return (
    <section className="admin-shell workspace" style={{ maxWidth: 1100 }}>
      <div className="section-heading admin-heading"><div><p className="eyebrow">CONFIGURAÇÃO ISOLADA</p><h3>Estágio profissional</h3></div></div>
      <p>Ative apenas as turmas de finalistas. Isto não altera nem elimina os relatórios escolares existentes. Os coordenadores de estágio atribuídos terão acesso apenas aos alunos que selecionar aqui.</p>
      {loading ? <p className="admin-status idle">A carregar...</p> : (
        <>
          <label className="admin-field" style={{ maxWidth: 420 }}><span>Turma</span>
            <select value={selectedTurmaId} onChange={(event) => { setSelectedTurmaId(event.target.value); setMessage(""); }}>
              {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}{turma.isInternship ? " · Estágio" : ""}</option>)}
            </select>
          </label>
          {selectedTurma && (
            <>
              <div className="admin-assignment-card" style={{ marginTop: 20 }}>
                <div className="admin-assignment-header">
                  <div><strong>{selectedTurma.name}</strong><small>{selectedTurma.students.length} aluno(s)</small></div>
                  <button type="button" className="admin-submit" disabled={busy === "mode"} onClick={() => updateMode(!selectedTurma.isInternship)}>
                    {busy === "mode" ? "A guardar..." : selectedTurma.isInternship ? "Desativar modo estágio" : "Marcar como turma de estágio"}
                  </button>
                </div>
                {selectedTurma.isInternship && (
                  <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                    {selectedTurma.students.map((student) => (
                      <article key={student.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 2fr) auto", gap: 12, alignItems: "end", borderTop: "1px solid #e5ece5", paddingTop: 14 }}>
                        <div><strong>{student.name}</strong><small style={{ display: "block", color: "#69766f" }}>{student.active ? "Ativo" : "Inativo"}</small></div>
                        <label className="admin-field"><span>Coordenadores com acesso individual</span>
                          <select multiple size={Math.min(4, Math.max(2, coordinators.length))} value={assignments[student.id] ?? []} onChange={(event) => setAssignments((current) => ({ ...current, [student.id]: Array.from(event.currentTarget.selectedOptions, (option) => option.value) }))}>
                            {coordinators.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.user.email}</option>)}
                          </select>
                        </label>
                        <button type="button" className="admin-submit" disabled={busy === student.id} onClick={() => saveStudent(student)}>{busy === student.id ? "A guardar..." : "Guardar"}</button>
                      </article>
                    ))}
                    {!selectedTurma.students.length && <p className="admin-status idle">Esta turma ainda não tem alunos.</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      {message && <p className="admin-status idle" role="status">{message}</p>}
    </section>
  );
}
