"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Fingerprint,
  House,
  ChevronDown,
  LoaderCircle,
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
  const [switchingSchool, setSwitchingSchool] = useState(false);
  const [schoolSwitchError, setSchoolSwitchError] = useState("");
  const isAdmin = role === "ADMIN";
  const activeMembership = schoolMemberships.find((membership) => membership.schoolId === activeSchoolId);

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
    if (!schoolId || schoolId === activeSchoolId || switchingSchool) return;
    setSwitchingSchool(true);
    setSchoolSwitchError("");
    try {
      const response = await fetch("/api/schools/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Não foi possível mudar de escola.");
      window.location.reload();
    } catch (error) {
      setSchoolSwitchError(error instanceof Error ? error.message : "Não foi possível mudar de escola.");
      setSwitchingSchool(false);
    }
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

        {schoolMemberships.length > 1 && (
          <div className={`school-switcher${switchingSchool ? " is-switching" : ""}`}>
            <label htmlFor="active-school-select" className="school-switcher-label">
              <span className="school-switcher-caption"><Building2 size={13} /> ESCOLA ATIVA</span>
              <span className="school-switcher-control">
                <select
                  id="active-school-select"
                  value={activeSchoolId ?? ""}
                  disabled={switchingSchool}
                  onChange={(event) => void changeSchool(event.target.value)}
                  aria-label="Mudar de escola ativa"
                >
                  <option value="" disabled>Selecione uma escola</option>
                  {schoolMemberships.map((membership) => (
                    <option key={membership.schoolId} value={membership.schoolId}>{membership.school.name}</option>
                  ))}
                </select>
                {switchingSchool ? <LoaderCircle className="school-switcher-spinner" size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </span>
            </label>
            <span className="school-switcher-role">{activeMembership?.role === "ADMIN" ? "Administrador" : activeMembership?.role === "DIRECCAO" ? "Direção" : activeMembership ? "Coordenador" : "A selecionar escola"}</span>
            {schoolSwitchError && <p className="school-switcher-error" role="alert">{schoolSwitchError}</p>}
          </div>
        )}

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
