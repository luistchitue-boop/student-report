"use client";

import Link from "next/link";
import { Activity, ArrowRight, BadgeCheck, BookOpenCheck, Building2, ClipboardCheck, FileBarChart2, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const actions = [
  { title: "Turmas", description: "Consultar turmas, alunos e registos.", href: "/turmas", icon: Users, roles: ["ADMIN", "DIRECCAO", "COORDENADOR"] },
  { title: "Relatórios", description: "Preparar e acompanhar relatórios.", href: "/admin/relatorios", icon: FileBarChart2, roles: ["ADMIN", "DIRECCAO"] },
  { title: "Coordenação", description: "Rever a atividade semanal.", href: "/controlo", icon: ClipboardCheck, roles: ["ADMIN", "DIRECCAO"] },
  { title: "Biométrico", description: "Registar a coordenação semanal.", href: "/biometrico", icon: ClipboardCheck, roles: ["COORDENADOR"] },
  { title: "Estágios", description: "Acompanhar o percurso de estágio.", href: "/internship-reports", icon: GraduationCap, roles: ["COORDENADOR"] },
  { title: "Administração", description: "Gerir contas e turmas da escola.", href: "/admin", icon: ShieldCheck, roles: ["ADMIN"] },
  { title: "Estágios", description: "Configurar turmas e relatórios.", href: "/admin/internships", icon: GraduationCap, roles: ["ADMIN"] },
];

export default function HomePage({
  stats,
  role,
}: {
  stats: {
    turmas: number;
    activeStudents: number;
    absencesToday: number;
  };
  role: string;
}) {
  const quickStats = [
    { label: "Turmas acompanhadas", value: stats.turmas, note: "No âmbito da sua função", icon: Building2 },
    { label: "Alunos ativos", value: stats.activeStudents, note: "Com matrícula ativa", icon: Users },
    { label: "Faltas hoje", value: stats.absencesToday, note: "Registadas neste dia", icon: ClipboardCheck },
  ];

  return (
    <AppShell active="inicio">
      <main className="dashboard-content mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-8 lg:px-8 lg:py-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-primary" /> Painel escolar
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Resumo geral</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe a atividade da escola e aceda rapidamente às ferramentas de gestão.
            </p>
          </div>
          <Link href="/turmas" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
            <Building2 className="size-4" /> Abrir turmas <ArrowRight className="size-4" />
          </Link>
        </section>

        <section aria-label="Indicadores da escola" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            const StatusIcon = index === 2 && stat.value > 0 ? Activity : BadgeCheck;
            const statusLabel = index === 2 ? (stat.value > 0 ? "Acompanhar" : "Em dia") : "Atualizado";
            return (
              <Card key={stat.label} className="dashboard-metric-card shadow-sm">
                <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                  <div className="space-y-1">
                    <CardDescription className="text-sm font-medium text-muted-foreground">{stat.label}</CardDescription>
                    <CardTitle className="text-3xl font-semibold tabular-nums tracking-tight">{stat.value.toLocaleString("pt-AO")}</CardTitle>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary"><Icon className="size-5" /></span>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{stat.note}</span>
                  <Badge variant="outline" className="gap-1 rounded-full font-medium">
                    <StatusIcon className="size-3" /> {statusLabel}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Acesso rápido</h2>
              <p className="text-sm text-muted-foreground">Continue o trabalho sem perder tempo a navegar.</p>
            </div>
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex"><BookOpenCheck className="size-3.5" /> Ferramentas</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.filter((action) => action.roles.includes(role)).map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} href={action.href} className="dashboard-action-card group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Card className="h-full shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-md">
                    <CardHeader className="gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold">{action.title}</CardTitle>
                        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                      <CardDescription className="text-xs leading-relaxed">{action.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <Card className="border-dashed bg-card/70 shadow-none">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><ShieldCheck className="size-4" /></span>
              <div>
                <p className="text-sm font-medium">Os dados refletem a escola ativa</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Mude de escola no menu lateral para consultar os indicadores correspondentes.</p>
              </div>
            </div>
            <Link href="/settings" className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:self-auto">
              Definições <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
