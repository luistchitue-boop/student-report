"use client";

import { useState } from "react";

const turmaOptions = [
  "1A", "1B", "2A", "2B", "2C", "3A", "3B", "4A", "4B", "4C",
  "5A", "5B", "5C", "6A", "6B", "6C", "7A", "7B", "7C", "7D",
  "8A", "8B", "9A", "9B", "10CEJ", "10CFBA", "10CFBB", "10CG", "10ETC", "10INF", "10OCC",
  "11CEJ", "11CFB", "11CG", "11ETC", "11INF", "11OCC", "12CEJ", "12CFB", "12CGB", "12CG", "12ETC",
  "12INF", "12OCC", "13CGB", "13CG", "13ETC", "13INF", "13OCC"
];

export function AdminClient() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>(["10CEJ", "10CFBA", "10CFBB"]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar o professor.");
      }

      setStatus("success");
      setMessage(`Professor criado com sucesso: ${data.teacher.name}`);
      setForm({ name: "", email: "", password: "" });
      setSelectedTurmas(["10CEJ", "10CFBA", "10CFBB"]);
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

  return (
    <section className="admin-shell workspace">
      <div className="section-heading admin-heading">
        <div>
          <p className="eyebrow">NOVO COORDENADOR</p>
          <h3>Criar professor e atribuir turmas</h3>
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
            {status === "saving" ? "A guardar..." : "Criar professor"}
          </button>
        </div>

        {message && (
          <p className={`admin-status ${status}`}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
