"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import type { ReactNode } from "react";

export function AppShell({ children, active }: { children: ReactNode; active: "reports" | "turmas" | "settings" | "admin" }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="img" aria-label="Livro">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 20.5z" />
                <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13a2 2 0 0 0-2 2v15a2 2 0 0 1 2-2h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
              </svg>
            </span>
            <span>
              NEPH <small>RELATORIOS</small>
            </span>
          </div>

          <button
            className="mobile-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <nav className={`sidebar-nav ${menuOpen ? "menu-open" : ""}`}>
          <Link href="/" className={active === "reports" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <span>▦</span> Relatorios
          </Link>
          <Link href="/turmas" className={active === "turmas" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <span>◫</span> Turmas
          </Link>
          <Link href="/#activity" className="" onClick={() => setMenuOpen(false)}>
            <span>↗</span> Activity
          </Link>
          {isAdmin && (
            <Link href="/admin" className={active === "admin" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
              <span>◈</span> Admin
            </Link>
          )}
          <Link href="/settings" className={active === "settings" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <span>⚙</span> Definições
          </Link>
        </nav>
      </aside>

      <div className="page-shell">{children}</div>
    </div>
  );
}
