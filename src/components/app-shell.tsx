"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const sectionTitles = {
  inicio: "Início",
  turmas: "Turmas e alunos",
  settings: "Definições da conta",
  admin: "Administração",
  direccao: "Gestão da direção",
  biometrico: "Coordenação semanal",
  controlo: "Controlo",
  relatorios: "Relatórios escolares",
  logs: "Registo de atividade",
  internships: "Relatórios de estágio",
} as const;

export function AppShell({ children, active }: { children: ReactNode; active: keyof typeof sectionTitles }) {
  const { data: session } = useSession();
  const [schoolMemberships, setSchoolMemberships] = useState<Array<{ schoolId: string; role: string; school: { id: string; name: string } }>>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [switchingSchool, setSwitchingSchool] = useState(false);
  const [schoolSwitchError, setSchoolSwitchError] = useState("");

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
    <SidebarProvider
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3.25rem", "--header-height": "3.75rem" } as React.CSSProperties}
      >
        <AppSidebar
          appRole={role}
          memberships={schoolMemberships}
          activeSchoolId={activeSchoolId}
          switchingSchool={switchingSchool}
          switchError={schoolSwitchError}
          onSwitchSchool={(schoolId) => void changeSchool(schoolId)}
          user={{
            name: session?.user?.name?.trim() || "Utilizador",
            email: session?.user?.email || "",
            image: session?.user?.image,
          }}
        />
        <SidebarInset className="min-h-svh bg-muted/30">
          <SiteHeader title={sectionTitles[active]} />
          {children}
        </SidebarInset>
    </SidebarProvider>
  );
}
