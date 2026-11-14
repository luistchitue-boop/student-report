"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import {
  Activity,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  FileBarChart2,
  Fingerprint,
  GraduationCap,
  House,
  Landmark,
  ScrollText,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";

type SchoolMembership = {
  schoolId: string;
  role: string;
  school: { id: string; name: string };
};

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  appRole: string | null;
  memberships: SchoolMembership[];
  activeSchoolId: string | null;
  switchingSchool: boolean;
  switchError: string;
  user: { name: string; email: string; image?: string | null };
  onSwitchSchool: (schoolId: string) => void;
};

type NavItem = { label: string; href: string; icon: LucideIcon };

function roleLabel(role?: string) {
  if (role === "ADMIN") return "Administrador";
  if (role === "DIRECCAO") return "Direção";
  if (role === "COORDENADOR") return "Coordenador";
  return "Utilizador";
}

export function AppSidebar({
  appRole,
  memberships,
  activeSchoolId,
  switchingSchool,
  switchError,
  user,
  onSwitchSchool,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const school = memberships.find((membership) => membership.schoolId === activeSchoolId);
  const mainItems: NavItem[] = [
    { label: "Início", href: "/", icon: House },
    { label: "Turmas", href: "/turmas", icon: Building2 },
  ];
  const coordinationItems: NavItem[] = [];
  const managementItems: NavItem[] = [];

  if (appRole === "COORDENADOR") {
    coordinationItems.push(
      { label: "Biométrico", href: "/biometrico", icon: Fingerprint },
      { label: "Estágios", href: "/internship-reports", icon: BookOpenCheck },
    );
  }
  if (appRole === "ADMIN") {
    coordinationItems.push({ label: "Controlo", href: "/controlo", icon: ClipboardCheck });
    managementItems.push(
      { label: "Administração", href: "/admin", icon: ShieldCheck },
      { label: "Direção", href: "/admin/direccao", icon: Landmark },
      { label: "Registo de atividade", href: "/admin/logs", icon: ScrollText },
      { label: "Relatórios", href: "/admin/relatorios", icon: FileBarChart2 },
      { label: "Estágios", href: "/admin/internships", icon: GraduationCap },
      { label: "Relatórios de estágio", href: "/admin/internship-reports", icon: BookOpenCheck },
    );
  }
  if (appRole === "DIRECCAO") {
    coordinationItems.push({ label: "Controlo", href: "/controlo", icon: ClipboardCheck });
    managementItems.push({ label: "Relatórios", href: "/admin/relatorios", icon: FileBarChart2 });
  }
  managementItems.push({ label: "Definições", href: "/settings", icon: Settings });

  function renderItems(items: NavItem[]) {
    return items.map(({ label, href, icon: Icon }) => {
      const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            render={<Link href={href} onClick={() => { if (isMobile) setOpenMobile(false); }} />}
            isActive={active}
            tooltip={label}
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  }

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="px-3 pb-3 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-12 items-center gap-3 px-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Activity className="size-5" />
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-bold tracking-tight">AEPH Relatórios</span>
                <span className="truncate text-xs text-muted-foreground">Gestão escolar</span>
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        {memberships.length > 0 && (
          <div className="school-switcher-card group-data-[collapsible=icon]:hidden">
            <label htmlFor="active-school-select" className="school-switcher-label">
              <span className="school-switcher-caption"><Building2 aria-hidden="true" /> Escola ativa</span>
              <select
                id="active-school-select"
                value={activeSchoolId ?? ""}
                disabled={switchingSchool || memberships.length < 2}
                onChange={(event) => onSwitchSchool(event.target.value)}
                aria-label="Escola ativa"
              >
                <option value="" disabled>Selecione uma escola</option>
                {memberships.map((membership) => (
                  <option key={membership.schoolId} value={membership.schoolId}>{membership.school.name}</option>
                ))}
              </select>
            </label>
            <span className="school-switcher-role">{school ? roleLabel(school.role) : switchingSchool ? "A mudar de escola…" : roleLabel(appRole ?? undefined)}</span>
            {switchError && <p className="school-switcher-error" role="alert">{switchError}</p>}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
        </SidebarGroup>
        {coordinationItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Coordenação</SidebarGroupLabel>
            <SidebarMenu>{renderItems(coordinationItems)}</SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
          <SidebarMenu>{renderItems(managementItems)}</SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2"><NavUser user={user} /></SidebarFooter>
    </Sidebar>
  );
}
