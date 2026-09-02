"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Building2,
  FileText,
  House,
  ShieldCheck,
  Settings,
  ScrollText,
} from "lucide-react";

export function AppShell({ children, active }: { children: ReactNode; active: "inicio" | "turmas" | "settings" | "admin" | "relatorios" | "logs" }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <BookOpen size={18} strokeWidth={2.2} />
            </span>
            <span>
              NEPH <small>Relatorios</small>
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
          <Link href="/" className={active === "inicio" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <House size={16} strokeWidth={2.1} /> Inicio
          </Link>
          <Link href="/turmas" className={active === "turmas" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <Building2 size={16} strokeWidth={2.1} /> Turmas
          </Link>
          {isAdmin && (
            <>
              <Link href="/admin" className={active === "admin" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ShieldCheck size={16} strokeWidth={2.1} /> Admin
              </Link>
              <Link href="/admin/logs" className={active === "logs" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ScrollText size={16} strokeWidth={2.1} /> Registo
              </Link>
              <Link href="/admin/relatorios" className={active === "relatorios" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <FileText size={16} strokeWidth={2.1} /> Relatorios
              </Link>
            </>
          )}
          <Link href="/settings" className={active === "settings" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <Settings size={16} strokeWidth={2.1} /> Definições
          </Link>
        </nav>
      </aside>

      <div className="page-shell">{children}</div>
    </div>
  );
}
