"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  presentations: "Apresentações",
  root: "Administração global",
} as const;

export function AppShell({ children, active }: { children: ReactNode; active: keyof typeof sectionTitles }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [schoolMemberships, setSchoolMemberships] = useState<Array<{ schoolId: string; role: string; school: { id: string; name: string } }>>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isRoot, setIsRoot] = useState(false);
  const [switchingSchool, setSwitchingSchool] = useState(false);
  const [schoolSwitchError, setSchoolSwitchError] = useState("");

  useEffect(() => {
    let activeRequest = true;
    fetch("/api/schools/active", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!activeRequest || !result) return;
        setSchoolMemberships(result.memberships ?? []);
        setActiveSchoolId(result.activeSchoolId ?? null);
        setRole(result.role ?? null);
        setIsRoot(result.isRoot === true);
      })
      .catch(() => {
        if (activeRequest) setRole(null);
      });
    return () => { activeRequest = false; };
  }, []);

  useEffect(() => {
    function updateSchoolProfile(event: Event) {
      const detail = (event as CustomEvent<{ schoolId: string; schoolName: string }>).detail;
      if (!detail?.schoolId) return;
      setSchoolMemberships((current) => current.map((membership) => membership.schoolId === detail.schoolId
        ? { ...membership, school: { ...membership.school, name: detail.schoolName } }
        : membership));
    }
    window.addEventListener("active-school-profile-updated", updateSchoolProfile);
    return () => window.removeEventListener("active-school-profile-updated", updateSchoolProfile);
  }, []);

  async function changeSchool(schoolId: string): Promise<boolean> {
    if (!schoolId || switchingSchool) return false;
    if (schoolId === activeSchoolId) return true;
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
      setActiveSchoolId(result.activeSchoolId ?? schoolId);
      setRole(result.role ?? null);
      setSwitchingSchool(false);
      router.replace("/");
      return true;
    } catch (error) {
      setSchoolSwitchError(error instanceof Error ? error.message : "Não foi possível mudar de escola.");
      setSwitchingSchool(false);
      return false;
    }
  }

  return (
    <SidebarProvider
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3.25rem", "--header-height": "3.75rem" } as React.CSSProperties}
      >
        <AppSidebar
          appRole={role}
          isRoot={isRoot}
          memberships={schoolMemberships}
          activeSchoolId={activeSchoolId}
          switchingSchool={switchingSchool}
          switchError={schoolSwitchError}
          onSwitchSchool={changeSchool}
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
