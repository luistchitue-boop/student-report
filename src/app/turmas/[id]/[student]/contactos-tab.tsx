"use client";

import { useState } from "react";

type Parent = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export function ContactosTab({ parents }: { parents: Parent[] }) {
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parentList, setParentList] = useState<Parent[]>(parents);

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
      <div style={{ color: "#4a5d5a", fontSize: "0.92rem", fontWeight: 600 }}>
        Contactos dos encarregados de educação.
      </div>

      {success && (
        <div
          style={{
            padding: "0.65rem 0.85rem",
            borderRadius: "8px",
            background: "#e8f5e9",
            color: "#2e7d32",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "1px solid #c8e6c9",
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
                background: "#fbfcf8",
                border: "1.5px solid #39755d",
                padding: "1rem",
                borderRadius: "10px",
              }}
            >
              <h3 style={{ margin: 0, color: "#244d3d", fontSize: "0.95rem", fontWeight: 700 }}>
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
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#39755d")}
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
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#39755d")}
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
                  Email
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
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#39755d")}
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
                    color: "#244d3d",
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
                    background: "#39755d",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    opacity: isLoading ? 0.55 : 1,
                  }}
                >
                  {isLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <article
              key={parent.id}
              style={{
                display: "grid",
                gap: "0.55rem",
                background: "#f7f8f4",
                border: "1px solid #e3e8e1",
                padding: "1rem",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                <strong style={{ color: "#244d3d", fontSize: "1.05rem" }}>
                  {parent.name}
                </strong>
                <button
                  onClick={() => handleEditClick(parent)}
                  style={{
                    minHeight: "2rem",
                    padding: "0.4rem 0.8rem",
                    border: "1px solid #ccd7cc",
                    borderRadius: "8px",
                    background: "#fbfcf8",
                    color: "#39755d",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Editar
                </button>
              </div>
              <div style={{ display: "grid", gap: "0.35rem", color: "#4a5d5a" }}>
                <a
                  href={`tel:${parent.phone}`}
                  style={{ color: "#39755d", fontWeight: 700 }}
                >
                  {parent.phone || "Telefone não informado"}
                </a>
                {parent.email ? (
                  <a
                    href={`mailto:${parent.email}`}
                    style={{ color: "#39755d", overflowWrap: "anywhere" }}
                  >
                    {parent.email}
                  </a>
                ) : (
                  <span>Email não informado</span>
                )}
              </div>
            </article>
          )
        )
      ) : (
        <div style={{ color: "#68756d" }}>Nenhum contacto registado.</div>
      )}
    </div>
  );
}
