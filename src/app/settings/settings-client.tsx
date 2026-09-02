"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string };

export function SettingsClient() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) throw new Error("Não foi possível carregar o perfil");
      const data = await response.json();
      setUser(data);
      setName(data.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o perfil");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() && !newPassword) {
      setError("Altere o nome ou a palavra-passe");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("As palavras-passe não coincidem");
      return;
    }

    if (newPassword && !currentPassword) {
      setError("A palavra-passe atual é obrigatória para alterar a palavra-passe");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível atualizar o perfil");
        return;
      }

      setUser(data.user);
      setSuccess("Perfil atualizado com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
        A carregar perfil...
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px" }}>
          <h1 style={{ color: "var(--navy)", marginBottom: "2rem" }}>Definições da conta</h1>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "#fce4e6",
            color: "#8b3a3a",
            fontSize: "0.9rem",
            fontWeight: 600,
            border: "1px solid #f5c6cc",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: "var(--green-soft)",
            color: "#254a3d",
            fontSize: "0.9rem",
            fontWeight: 600,
            border: "1px solid #c5e1ce",
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "grid", gap: "1.5rem" }}>
        {/* Email Display */}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
            E-mail
          </label>
          <div
            style={{
              padding: "0.75rem",
              background: "#f5f6f4",
              borderRadius: "8px",
              color: "var(--muted)",
              fontSize: "0.95rem",
            }}
          >
            {user?.email}
          </div>
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>O e-mail não pode ser alterado</small>
        </div>

        {/* Name Field */}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label htmlFor="name" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
            Nome
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O seu nome completo"
            style={{
              padding: "0.75rem",
              border: "1px solid #ccd9ce",
              borderRadius: "8px",
              fontSize: "0.95rem",
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
          />
        </div>

        {/* Password Section */}
        <fieldset
          style={{
            border: "1px solid #dfe5df",
            borderRadius: "8px",
            padding: "1rem",
            display: "grid",
            gap: "1rem",
          }}
        >
          <legend style={{ fontWeight: 700, color: "var(--navy)", fontSize: "0.9rem" }}>
            Alterar palavra-passe
          </legend>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="currentPassword" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
              Palavra-passe atual
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Introduza a sua palavra-passe atual"
              style={{
                padding: "0.75rem",
                border: "1px solid #ccd9ce",
                borderRadius: "8px",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
            />
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="newPassword" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
              Nova palavra-passe
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Introduza uma nova palavra-passe (mín. 6 caracteres)"
              style={{
                padding: "0.75rem",
                border: "1px solid #ccd9ce",
                borderRadius: "8px",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
            />
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label htmlFor="confirmPassword" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
              Confirmar nova palavra-passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova palavra-passe"
              style={{
                padding: "0.75rem",
                border: "1px solid #ccd9ce",
                borderRadius: "8px",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ccd9ce")}
            />
          </div>
        </fieldset>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          style={{
            padding: "0.85rem 2rem",
            background: "var(--green)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.6 : 1,
            textTransform: "uppercase",
          }}
        >
          {isSaving ? "A guardar..." : "Guardar Alterações"}
        </button>
      </form>
    </div>
  );
}
