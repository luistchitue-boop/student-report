import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children, active }: { children: ReactNode; active: "reports" | "turmas" }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>
            AEph <small>RELATORIOS</small>
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
