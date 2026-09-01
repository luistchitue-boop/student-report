"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const actions = [
  { title: "Turmas", description: "Consultar turmas e alunos", href: "/turmas", accent: "primary" },
  { title: "Definições", description: "Configurar conta e preferências", href: "/settings", accent: "secondary" },
  { title: "Admin", description: "Gerir professores e atribuições", href: "/admin", accent: "neutral" },
];

export default function HomePage({
  stats,
}: {
  stats: {
    turmas: number;
    activeStudents: number;
    absencesToday: number;
  };
}) {
  const { data: session } = useSession();
  const quickStats = [
    { label: "Turmas", value: String(stats.turmas), hint: "total" },
    { label: "Alunos ativos", value: String(stats.activeStudents), hint: "matriculados" },
    { label: "Faltas hoje", value: String(stats.absencesToday), hint: "registadas" },
  ];

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session?.user?.email
      ? session.user.email.substring(0, 2).toUpperCase()
      : "U";

  return (
    <AppShell active="inicio">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">GABINETE ESCOLAR / 2026</p>
            <h1>Início</h1>
          </div>
          <div className="profile">
            <span className="status-dot" /> Conectado
            <span className="avatar" title={session?.user?.email ?? undefined}>{userInitials}</span>
            <button className="sign-out-btn" onClick={() => signOut({ redirectTo: "/auth/signin" })}>Sair</button>
          </div>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow accent">PAINEL GERAL</p>
            <h2>Bem-vindo ao portal da Coordenação</h2>
            <p className="lede">Acompanhe turmas, alunos, presenças e relatórios num único painel.</p>
          </div>
          <div className="whatsapp-glyph">▣</div>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div>
              <p className="eyebrow">VISÃO GERAL</p>
              <h3>Resumo do dia</h3>
            </div>
          </div>

          <div className="stats-grid">
            {quickStats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.hint}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="send-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ATALHOS</p>
              <h3>Gestão rápida</h3>
            </div>
          </div>

          <div className="quick-actions">
            {actions.map((action) => (
              <Link key={action.title} href={action.href} className={`action-card ${action.accent}`}>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </Link>
            ))}
          </div>
        </section>

      </main>

      <style>{`
        .sign-out-btn {
          margin-left: 1rem;
          padding: 0.5rem 1rem;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }

        .sign-out-btn:hover {
          background-color: #e0e0e0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .stat-card {
          background: #f7f8fb;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .stat-card span {
          color: #5b6477;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-card strong {
          font-size: clamp(1.6rem, 4vw, 2.2rem);
          line-height: 1;
        }

        .stat-card small {
          color: #6b7280;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .action-card {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          padding: 1.1rem;
          border-radius: 16px;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          border: 1px solid transparent;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .action-card.primary {
          background: linear-gradient(135deg, #e0f2fe, #dbeafe);
          border-color: #bfdbfe;
          color: #0f172a;
        }

        .action-card.secondary {
          background: linear-gradient(135deg, #ecfdf5, #d1fae5);
          border-color: #bbf7d0;
          color: #0f172a;
        }

        .action-card.neutral {
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
          border-color: #d1d5db;
          color: #0f172a;
        }

        .action-card strong {
          font-size: 1.05rem;
        }

        .action-card span {
          color: rgba(15, 23, 42, 0.75);
        }

      `}</style>
    </AppShell>
  );
}
