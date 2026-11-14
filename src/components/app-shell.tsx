"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Fingerprint,
  House,
  ShieldCheck,
  Settings,
  ScrollText,
  Landmark,
} from "lucide-react";

export function AppShell({ children, active }: { children: ReactNode; active: "inicio" | "turmas" | "settings" | "admin" | "direccao" | "biometrico" | "controlo" | "relatorios" | "logs" | "internships" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [schoolMemberships, setSchoolMemberships] = useState<Array<{ schoolId: string; role: string; school: { id: string; name: string } }>>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [schoolError, setSchoolError] = useState("");
  const isAdmin = role === "ADMIN";

  useEffect(() => {
    let activeRequest = true;
    fetch("/api/schools/active")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!activeRequest || !result) return;
        setSchoolMemberships(result.memberships ?? []);
        setActiveSchoolId(result.activeSchoolId ?? null);
        setRole(result.role ?? null);
      })
      .catch(() => {
        if (activeRequest) setRole(null);
      });
    return () => { activeRequest = false; };
  }, []);

  async function changeSchool(schoolId: string) {
    const response = await fetch("/api/schools/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    if (response.ok) window.location.reload();
  }

  async function createSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSchoolError("");
    const response = await fetch("/api/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSchoolName }),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    const result = await response.json().catch(() => null);
    setSchoolError(result?.error ?? "Não foi possível registar a escola.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <BookOpen size={18} strokeWidth={2.2} />
            </span>
            <span>
              NEPH <small>Relatórios</small>
            </span>
          </div>

          {schoolMemberships.length > 1 && (
            <label className="school-switcher-label">
              <span>Escola ativa</span>
              <select
                aria-label="Selecionar escola ativa"
                value={activeSchoolId ?? ""}
                onChange={(event) => void changeSchool(event.target.value)}
              >
                <option value="" disabled>Selecione uma escola</option>
                {schoolMemberships.map((membership) => (
                  <option key={membership.schoolId} value={membership.schoolId}>{membership.school.name}</option>
                ))}
              </select>
            </label>
          )}
          {role === "ADMIN" && (
            <form onSubmit={createSchool} className="school-create-form">
              <input
                aria-label="Nome da nova escola"
                value={newSchoolName}
                onChange={(event) => setNewSchoolName(event.target.value)}
                placeholder="Nome de outra escola"
                maxLength={160}
                required
              />
              <button type="submit">Adicionar escola</button>
              {schoolError && <p role="alert">{schoolError}</p>}
            </form>
          )}

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
            <House size={16} strokeWidth={2.1} /> Início
          </Link>
          <Link href="/turmas" className={active === "turmas" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
            <Building2 size={16} strokeWidth={2.1} /> Turmas
          </Link>
          {role === "COORDENADOR" && (
            <>
              <Link href="/biometrico" className={active === "biometrico" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <Fingerprint size={16} strokeWidth={2.1} /> Biométrico
              </Link>
              <Link href="/internship-reports" className={active === "internships" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <FileText size={16} strokeWidth={2.1} /> Estágios
              </Link>
            </>
          )}
          {isAdmin && (
            <>
              <Link href="/controlo" className={active === "controlo" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ClipboardCheck size={16} strokeWidth={2.1} /> Controlo
              </Link>
              <Link href="/admin" className={active === "admin" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ShieldCheck size={16} strokeWidth={2.1} /> Admin
              </Link>
              <Link href="/admin/direccao" className={active === "direccao" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <Landmark size={16} strokeWidth={2.1} /> Direção
              </Link>
              <Link href="/admin/logs" className={active === "logs" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ScrollText size={16} strokeWidth={2.1} /> Registo
              </Link>
              <Link href="/admin/relatorios" className={active === "relatorios" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <FileText size={16} strokeWidth={2.1} /> Relatórios
              </Link>
            </>
          )}
          {role === "DIRECCAO" && (
            <>
              <Link href="/controlo" className={active === "controlo" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <ClipboardCheck size={16} strokeWidth={2.1} /> Controlo
              </Link>
              <Link href="/admin/relatorios" className={active === "relatorios" ? "nav-active" : ""} onClick={() => setMenuOpen(false)}>
                <FileText size={16} strokeWidth={2.1} /> Relatórios
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
