"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ParentLookupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/public/parents/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível encontrar o perfil.");
      }

      router.push(`/encarregado/${result.parentId}`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Não foi possível encontrar o perfil.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem 1rem", background: "#f5f7f4" }}>
      <section style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 18, boxShadow: "0 10px 30px rgba(25, 52, 45, 0.08)", padding: "2rem", border: "1px solid #dfe7e1" }}>
        <p style={{ margin: "0 0 0.4rem", color: "#2f7d5a", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Acesso público</p>
        <h1 style={{ margin: "0 0 0.75rem", color: "#163b31", fontSize: "1.8rem" }}>Atualize os seus contactos</h1>
        <p style={{ margin: "0 0 1.5rem", color: "#53645b", lineHeight: 1.6 }}>
          Introduza o nome completo sem espaços, em letras minúsculas e sem caracteres especiais.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.5rem", color: "#163b31", fontWeight: 600 }}>
            Nome completo
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="joaoluispereira"
              inputMode="text"
              autoComplete="name"
              required
              pattern="[a-z]+"
              title="Use apenas letras minúsculas, sem espaços nem caracteres especiais."
              style={{ width: "100%", minHeight: 46, border: "1px solid #c3d0c8", borderRadius: 10, padding: "0 0.9rem", fontSize: "1rem" }}
            />
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, color: "#8a2431", background: "#fff0f3", border: "1px solid #e7b8c3", borderRadius: 8, padding: "0.75rem 0.85rem" }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} style={{ minHeight: 46, border: 0, borderRadius: 10, background: "#2f7d5a", color: "#fff", fontWeight: 700, cursor: isSubmitting ? "wait" : "pointer" }}>
            {isSubmitting ? "A procurar..." : "Continuar"}
          </button>
        </form>
      </section>
    </main>
  );
}
