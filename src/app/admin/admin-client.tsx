"use client";

import { useEffect, useState } from "react";

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

type ExistingTeacher = { id: string; name: string; role: string; user: { email: string }; turmaAssignments: { turmaId: string }[] };
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
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"COORDENADOR" | "DIRECCAO" | "ADMIN">("COORDENADOR");
  const [turmaToAdd, setTurmaToAdd] = useState("");

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
  }

  useEffect(() => { loadAssignments(); }, []);

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
      body: JSON.stringify({ teacherId, role: teacherId === selectedTeacherId ? selectedRole : existingTeachers.find((teacher) => teacher.id === teacherId)?.role, turmaIds: assignmentState[teacherId] ?? [] }),
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
    <section className="admin-shell workspace">
      <div className="section-heading admin-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Nome do professor</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: João da Silva"
            />
          </label>

          <label className="admin-field">
            <span>Email institucional</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="professor@escola.ao"
            />
          </label>

          <label className="admin-field">
            <span>Senha temporária</span>
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Digite uma senha segura"
            />
          </label>
        </div>

        <div className="admin-turma-panel">
          <p className="eyebrow admin-label">Turmas atribuídas</p>
          <div className="admin-turma-grid">
            {turmaOptions.map((turma) => (
              <label key={turma} className={`admin-checkbox ${selectedTurmas.includes(turma) ? "selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={selectedTurmas.includes(turma)}
                  onChange={() => toggleTurma(turma)}
                />
                <span>{turma}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="admin-actions">
          <button className="admin-submit" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "A guardar..." : defaultRole === "DIRECCAO" ? "Criar direção" : "Criar professor"}
          </button>
        </div>

        {message && (
          <p className={`admin-status ${status}`}>
            {message}
          </p>
        )}
      </form>

      <div className="admin-existing-assignments">
        <div className="section-heading admin-heading">
          <div><p className="eyebrow">ATRIBUIÇÕES EXISTENTES</p><h3>Aumentar ou reduzir turmas</h3></div>
        </div>
        {existingTeachers.length > 0 && selectedTeacher && (
          <article className="admin-assignment-card">
            <label className="admin-field"><span>Conta</span><select value={selectedTeacherId} onChange={(event) => { const teacherId = event.target.value; const teacher = existingTeachers.find((item) => item.id === teacherId); setSelectedTeacherId(teacherId); setSelectedRole((teacher?.role as "COORDENADOR" | "DIRECCAO" | "ADMIN") ?? "COORDENADOR"); setTurmaToAdd(""); }}>
              {existingTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.user.email}</option>)}
            </select></label>
            <div className="admin-assignment-header"><div><strong>{selectedTeacher.name}</strong><small>{selectedRole} · {selectedTeacherTurmas.length} turma(s) atribuída(s)</small></div><div className="admin-assignment-actions"><button type="button" className="admin-submit" onClick={() => saveAssignments(selectedTeacher.id)}>Guardar alterações</button><button type="button" className="admin-remove-button" onClick={() => removeUser(selectedTeacher.id)}>Remover conta</button></div></div>
            <label className="admin-field"><span>Perfil</span><select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as "COORDENADOR" | "DIRECCAO" | "ADMIN")}><option value="COORDENADOR">Coordenador</option><option value="DIRECCAO">Direção</option><option value="ADMIN">Administrador</option></select></label>
            <div className="admin-assignment-chips">
              {selectedTeacherTurmas.length ? selectedTeacherTurmas.map((turmaId) => <span key={turmaId} className="admin-assignment-chip">{existingTurmas.find((turma) => turma.id === turmaId)?.name ?? "Turma"}<button type="button" onClick={() => removeAssignment(turmaId)} aria-label="Remover turma">×</button></span>) : <span className="admin-assignment-empty">Nenhuma turma atribuída</span>}
            </div>
            <div className="admin-assignment-add"><select value={turmaToAdd} onChange={(event) => setTurmaToAdd(event.target.value)}><option value="">Adicionar uma turma...</option>{availableTurmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}</select><button type="button" className="admin-assignment-add-button" onClick={addAssignment} disabled={!turmaToAdd}>Adicionar</button></div>
          </article>
        )}
        {!existingTeachers.length && <p className="admin-status idle">Ainda não existem contas para editar.</p>}
        {assignmentMessage && <p className="admin-status success">{assignmentMessage}</p>}
      </div>
    </section>
  );
}
