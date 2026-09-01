import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children, active }: { children: ReactNode; active: "reports" | "turmas" | "settings" }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
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

        <nav>
          <Link href="/" className={active === "reports" ? "nav-active" : ""}>
            <span>▦</span> Relatorios
          </Link>
          <Link href="/turmas" className={active === "turmas" ? "nav-active" : ""}>
            <span>◫</span> Turmas
          </Link>
          <Link href="/#activity" className="">
            <span>↗</span> Activity
          </Link>
          <Link href="/settings" className={active === "settings" ? "nav-active" : ""}>
            <span>⚙</span> Definições
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="help-mark">?</div>
          <div>
            <strong>Need a hand?</strong>
            <small>Read the sending guide</small>
          </div>
        </div>
      </aside>

      <div className="page-shell">{children}</div>
    </div>
  );
}
