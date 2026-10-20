"use client";

import { useState, type FormEvent } from "react";

type Parent = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export function ContactosTab({ parents, turmaId, studentId, canAddParent }: { parents: Parent[]; turmaId: string; studentId: string; canAddParent: boolean }) {
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parentList, setParentList] = useState<Parent[]>(parents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddParent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addName.trim() || !addPhone.trim()) {
      setAddError("Nome e telefone são obrigatórios");
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${studentId}/parents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        setAddError(result.message || "Erro ao adicionar encarregado");
        return;
      }

      setParentList((current) => [...current, result as Parent]);
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setShowAddForm(false);
      setSuccess("Encarregado adicionado com sucesso");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to add parent:", err);
      setAddError("Erro ao conectar ao servidor");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditClick = (parent: Parent) => {
    setEditingParentId(parent.id);
    setEditName(parent.name);
    setEditPhone(parent.phone);
    setEditEmail(parent.email);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingParentId(null);
    setEditName("");
    setEditPhone("");
    setEditEmail("");
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      setError("Nome e telefone são obrigatórios");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/parents/${editingParentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
        }),
      });

      if (response.ok) {
        const updatedParent = await response.json();
        setParentList(
          parentList.map((p) => (p.id === editingParentId ? updatedParent : p))
        );
        setSuccess("Dados guardados com sucesso");
        setEditingParentId(null);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Erro ao guardar");
      }
    } catch (err) {
      console.error("Failed to update parent:", err);
      setError("Erro ao conectar ao servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <div style={{ color: "var(--muted)", fontSize: "0.92rem", fontWeight: 600, letterSpacing: "0.05em" }}>
        Contactos dos encarregados de educação
      </div>

      {canAddParent && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => { setShowAddForm(true); setAddError(null); }}
              style={{ minHeight: "2.5rem", padding: "0.55rem 1rem", border: "0", borderRadius: "9px", background: "var(--green)", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              + Adicionar encarregado
            </button>
          ) : (
            <form onSubmit={handleAddParent} style={{ display: "grid", gap: "0.75rem", background: "#fff", border: "1.5px solid var(--green)", padding: "1rem", borderRadius: "14px" }}>
              <h3 style={{ margin: 0, color: "var(--navy)", fontSize: "0.95rem", fontWeight: 700 }}>Novo encarregado</h3>
              <label style={{ display: "grid", gap: "0.35rem", color: "#53645b", fontSize: "0.75rem", fontWeight: 700 }}>
                Nome *
                <input required value={addName} onChange={(event) => setAddName(event.target.value)} autoComplete="name" style={{ minHeight: "2.45rem", padding: "0.55rem 0.65rem", border: "1px solid #ccd9ce", borderRadius: "9px", fontSize: "0.9rem" }} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem", color: "#53645b", fontSize: "0.75rem", fontWeight: 700 }}>
                Telefone *
                <input required type="tel" value={addPhone} onChange={(event) => setAddPhone(event.target.value)} autoComplete="tel" style={{ minHeight: "2.45rem", padding: "0.55rem 0.65rem", border: "1px solid #ccd9ce", borderRadius: "9px", fontSize: "0.9rem" }} />
              </label>
              <label style={{ display: "grid", gap: "0.35rem", color: "#53645b", fontSize: "0.75rem", fontWeight: 700 }}>
                E-mail
                <input type="email" value={addEmail} onChange={(event) => setAddEmail(event.target.value)} autoComplete="email" style={{ minHeight: "2.45rem", padding: "0.55rem 0.65rem", border: "1px solid #ccd9ce", borderRadius: "9px", fontSize: "0.9rem" }} />
              </label>
              {addError && <div role="alert" style={{ color: "#8b3a3a", fontSize: "0.8rem", fontWeight: 600 }}>{addError}</div>}
              <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end" }}>
                <button type="button" disabled={isAdding} onClick={() => { setShowAddForm(false); setAddError(null); }} style={{ minHeight: "2.45rem", padding: "0.5rem 1rem", border: "1px solid #ccd7cc", borderRadius: "9px", background: "#fbfcf8", color: "var(--ink)", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={isAdding} style={{ minHeight: "2.45rem", padding: "0.5rem 1rem", border: "0", borderRadius: "9px", background: "var(--green)", color: "#fff", fontWeight: 700, cursor: isAdding ? "not-allowed" : "pointer", opacity: isAdding ? 0.55 : 1 }}>{isAdding ? "A adicionar..." : "Adicionar"}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "10px",
            background: "var(--green-soft)",
            color: "#254a3d",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "1px solid #c5e1ce",
          }}
        >
          {success}
        </div>
      )}

      {parentList.length ? (
        parentList.map((parent) =>
          editingParentId === parent.id ? (
            <div
              key={parent.id}
              style={{
                display: "grid",
                gap: "0.75rem",
                background: "#fff",
                border: "1.5px solid var(--green)",
                padding: "1rem",
                borderRadius: "14px",
                boxShadow: "0 2px 8px rgba(57, 117, 93, 0.1)",
              }}
            >
              <h3 style={{ margin: 0, color: "var(--navy)", fontSize: "0.95rem", fontWeight: 700 }}>
                Editar Encarregado
              </h3>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#53645b",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.4rem",
                  }}
                >
                  Nome *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "2.45rem",
                    padding: "0.55rem 0.65rem",
                    border: "1px solid #ccd9ce",
                    borderRadius: "9px",
                    background: "#fff",
                    outline: "none",
                    fontSize: "0.9rem",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#53645b",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.4rem",
                  }}
                >
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "2.45rem",
                    padding: "0.55rem 0.65rem",
                    border: "1px solid #ccd9ce",
                    borderRadius: "9px",
                    background: "#fff",
                    outline: "none",
                    fontSize: "0.9rem",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#53645b",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.4rem",
                  }}
                >
                  E-mail
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "2.45rem",
                    padding: "0.55rem 0.65rem",
                    border: "1px solid #ccd9ce",
                    borderRadius: "9px",
                    background: "#fff",
                    outline: "none",
                    fontSize: "0.9rem",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    background: "#fce4e6",
                    color: "#8b3a3a",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "1px solid #f5c6cc",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end" }}>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    minHeight: "2.45rem",
                    padding: "0.5rem 1rem",
                    border: "1px solid #ccd7cc",
                    borderRadius: "9px",
                    background: "#fbfcf8",
                    color: "var(--ink)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isLoading}
                  style={{
                    minHeight: "2.45rem",
                    padding: "0.5rem 1rem",
                    border: "0",
                    borderRadius: "9px",
                    background: "var(--green)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    opacity: isLoading ? 0.55 : 1,
                  }}
                >
                  {isLoading ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <article
              key={parent.id}
              style={{
                display: "grid",
                gap: "0.75rem",
                background: "#fff",
                border: "1px solid #dfe5df",
                padding: "1rem",
                borderRadius: "12px",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
              }}
            >
              <div style={{ display: "grid", gap: "0.55rem" }}>
                <strong style={{ color: "var(--navy)", fontSize: "1.05rem", fontWeight: 700 }}>
                  {parent.name}
                </strong>
                <div style={{ display: "grid", gap: "0.35rem", color: "var(--muted)" }}>
                  <a
                    href={`tel:${parent.phone}`}
                    style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}
                  >
                    {parent.phone || "Telefone não informado"}
                  </a>
                  {parent.email ? (
                    <a
                      href={`mailto:${parent.email}`}
                      style={{ color: "var(--green)", overflowWrap: "anywhere", textDecoration: "none" }}
                    >
                      {parent.email}
                    </a>
                  ) : (
                    <span>E-mail não indicado</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleEditClick(parent)}
                style={{
                  minHeight: "2rem",
                  padding: "0.4rem 0.8rem",
                  border: "1px solid #ccd7cc",
                  borderRadius: "8px",
                  background: "#fbfcf8",
                  color: "var(--green)",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--green)";
                  e.currentTarget.style.background = "var(--green-soft)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#ccd7cc";
                  e.currentTarget.style.background = "#fbfcf8";
                }}
              >
                Editar
              </button>
            </article>
          )
        )
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Nenhum contacto registado.</div>
      )}
    </div>
  );
}
