"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Turma = { id: string; name: string };
type ParentForm = { name: string; phone: string; email: string };

const emptyParent = (): ParentForm => ({ name: "", phone: "", email: "" });

export function NewStudentClient({ turma }: { turma: Turma }) {
  const [name, setName] = useState("");
  const [parents, setParents] = useState<ParentForm[]>([emptyParent()]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function updateParent(index: number, field: keyof ParentForm, value: string) {
    setParents((current) => current.map((parent, parentIndex) => parentIndex === index ? { ...parent, [field]: value } : parent));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch(`/api/turmas/${turma.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parents }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registar o aluno.");
      setStatus("Aluno registado com sucesso.");
      setName("");
      setParents([emptyParent()]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível registar o aluno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main-content new-student-shell">
      <header className="topbar turma-topbar">
        <div>
          <p className="eyebrow">REGISTO DE ALUNO</p>
          <h1>Novo aluno</h1>
          <p className="attendance-book-subtitle">{turma.name}</p>
        </div>
        <Link href={`/turmas/${turma.id}`} className="dashboard-link">← Voltar à turma</Link>
      </header>

      <form className="new-student-panel" onSubmit={submit}>
        <section className="new-student-section">
          <p className="eyebrow">DADOS DO ALUNO</p>
          <h2>Informação pessoal</h2>
          <div className="new-student-fields student-fields">
            <label>Nome completo<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          </div>
        </section>

        {parents.map((parent, index) => (
          <section className="new-student-section" key={index}>
            <p className="eyebrow">ENCARREGADO {index + 1}</p>
            <h2>{index === 0 ? "Contacto principal" : "Contacto adicional"}</h2>
            <div className="new-student-fields parent-fields">
              <label>Nome<input required={index === 0} value={parent.name} onChange={(event) => updateParent(index, "name", event.target.value)} /></label>
              <label>Telefone<input required={index === 0} type="tel" value={parent.phone} onChange={(event) => updateParent(index, "phone", event.target.value)} /></label>
              <label>Email<input type="email" value={parent.email} onChange={(event) => updateParent(index, "email", event.target.value)} /></label>
            </div>
          </section>
        ))}

        {parents.length < 2 ? <button type="button" className="attendance-select-all new-student-add-parent" onClick={() => setParents((current) => [...current, emptyParent()])}>+ Adicionar outro encarregado</button> : null}
        <div className="new-student-actions">
          <Link href={`/turmas/${turma.id}`} className="new-student-cancel">Cancelar</Link>
          <button type="submit" className="new-student-submit" disabled={saving}>{saving ? "A guardar..." : "Registar aluno"}</button>
        </div>
        {status ? <p className={status.includes("sucesso") ? "attendance-book-status" : "new-student-status"}>{status}</p> : null}
      </form>
    </main>
  );
}
