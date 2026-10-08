import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto confirmado",
  description: "A alteração dos seus contactos foi confirmada.",
};

export default function ParentContactConfirmedPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem 1rem", background: "#f5f7f4" }}>
      <section style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 18, padding: "2rem", border: "1px solid #dfe7e1", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 0.75rem", color: "#163b31", fontSize: "1.8rem" }}>Alteração confirmada</h1>
        <p style={{ margin: 0, color: "#53645b", lineHeight: 1.6 }}>
          Os seus contactos foram atualizados com sucesso.
        </p>
      </section>
    </main>
  );
}
