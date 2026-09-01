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
    <section className="workspace" style={{ maxWidth: 900 }}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">NOVO COORDENADOR</p>
          <h3>Criar professor e atribuir turmas</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="add-report" style={{ display: "grid", gap: 16 }}>
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Nome do professor"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="endereco@escola.ao"
        />
        <input
          required
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Senha temporária"
        />

        <div>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Turmas atribuídas</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
            {turmaOptions.map((turma) => (
              <label key={turma} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={selectedTurmas.includes(turma)}
                  onChange={() => toggleTurma(turma)}
                />
                {turma}
              </label>
            ))}
          </div>
        </div>

        <button className="send-button" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "A guardar..." : "Criar professor"}
        </button>

        {message && (
          <p className={`form-status ${status}`} style={{ margin: 0 }}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
