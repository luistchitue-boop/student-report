"use client";

import { useState } from "react";

type StudentSummary = {
  id: string;
  name: string;
  turma: { id: string; name: string } | null;
};

type ParentSummary = {
  id: string;
  name: string;
  phone: string;
  email: string;
  student: StudentSummary | null;
};

export function ParentContactEditor({
  parent,
}: {
  parent: ParentSummary;
}) {
  const [phone, setPhone] = useState(parent.phone);
  const [email, setEmail] = useState(parent.email);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/public/parents/${parent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível enviar a confirmação.");
      }

      setConfirmationSent(true);
      setSuccess(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível enviar a confirmação.");
    } finally {
      setIsSaving(false);
    }
  }

  const student = parent.student;

  return (
    <main style={{ minHeight: "100vh", padding: "2rem 1rem", background: "#f5f7f4" }}>
      <section style={{ width: "100%", maxWidth: 680, margin: "0 auto", background: "#fff", borderRadius: 18, boxShadow: "0 10px 30px rgba(25, 52, 45, 0.08)", padding: "2rem", border: "1px solid #dfe7e1" }}>
        <p style={{ margin: "0 0 0.4rem", color: "#2f7d5a", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dados do encarregado</p>
        <h1 style={{ margin: "0 0 0.25rem", color: "#163b31", fontSize: "1.75rem" }}>{parent.name}</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#53645b" }}>Atualize os contactos associados ao aluno abaixo.</p>

        {student ? (
          <div style={{ display: "grid", gap: "1rem", padding: "1rem", borderRadius: 12, background: "#f2f6f3", border: "1px solid #dfe7e1" }}>
            <div>
              <div style={{ color: "#53645b", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Aluno</div>
              <div style={{ color: "#163b31", fontSize: "1.1rem", fontWeight: 700 }}>{student.name}</div>
              {student.turma && <div style={{ color: "#53645b" }}>{student.turma.name}</div>}
            </div>

            <label style={{ display: "grid", gap: "0.45rem", color: "#163b31", fontWeight: 600 }}>
              Telefone
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="912345678"
                required
                style={{ width: "100%", minHeight: 46, border: "1px solid #c3d0c8", borderRadius: 10, padding: "0 0.9rem", fontSize: "1rem" }}
              />
            </label>

            <label style={{ display: "grid", gap: "0.45rem", color: "#163b31", fontWeight: 600 }}>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@exemplo.pt"
                style={{ width: "100%", minHeight: 46, border: "1px solid #c3d0c8", borderRadius: 10, padding: "0 0.9rem", fontSize: "1rem" }}
              />
            </label>

            {error && (
              <p role="alert" style={{ margin: 0, color: "#8a2431", background: "#fff0f3", border: "1px solid #e7b8c3", borderRadius: 8, padding: "0.75rem 0.85rem" }}>
                {error}
              </p>
            )}

            {success && (
              <p style={{ margin: 0, color: "#254a3d", background: "#eaf7ef", border: "1px solid #c5e1ce", borderRadius: 8, padding: "0.75rem 0.85rem" }}>
                Contactos confirmados e guardados com sucesso.
              </p>
            )}

            {confirmationSent && (
              <p style={{ margin: 0, color: "#254a3d", background: "#eaf7ef", border: "1px solid #c5e1ce", borderRadius: 8, padding: "0.75rem 0.85rem" }}>
                Foi enviado um e-mail de confirmação. Clique no link recebido para guardar as alterações.
              </p>
            )}

            <button type="button" onClick={handleSubmit} disabled={isSaving} style={{ minHeight: 46, border: 0, borderRadius: 10, background: "#2f7d5a", color: "#fff", fontWeight: 700, cursor: isSaving ? "wait" : "pointer" }}>
              {isSaving ? "A enviar confirmação..." : "Guardar contactos"}
            </button>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#53645b" }}>Este perfil não está associado a nenhum aluno ativo.</p>
        )}
      </section>
    </main>
  );
}
