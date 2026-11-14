"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentProps } from "react";
import {
  Activity,
  BadgeCheck,
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
  ChevronRight,
  Plus,
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
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
            className="group-data-[collapsible=icon]:mx-auto! group-data-[collapsible=icon]:justify-center!"
          >
            <Icon />
            <span className="group-data-[collapsible=icon]:hidden">{label}</span>
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
            <Dialog open={schoolDialogOpen} onOpenChange={setSchoolDialogOpen}>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full min-w-0 justify-start gap-3 px-2 text-left hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center! group-data-[collapsible=icon]:px-0!"
                    aria-label={`Escola ativa: ${school?.school.name ?? "AEPH Relatórios"}. Abrir opções de escola`}
                  />
                }
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Activity className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-bold tracking-tight" title={school?.school.name ?? "AEPH Relatórios"}>
                    {school?.school.name ?? "AEPH Relatórios"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Gestão escolar</span>
                </span>
              </DialogTrigger>
              <DialogContent className="max-h-[min(85svh,42rem)] overflow-y-auto sm:max-w-md">
                <DialogCloseButton />
                <DialogHeader>
                  <DialogTitle>Escolas da sua conta</DialogTitle>
                  <DialogDescription>Escolha a escola ativa para abrir os respetivos dados e ferramentas.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                  {memberships.map((membership) => {
                    const active = membership.schoolId === activeSchoolId;
                    return (
                      <Button
                        key={membership.schoolId}
                        type="button"
                        variant={active ? "secondary" : "outline"}
                        className="h-auto min-h-14 w-full justify-start gap-3 whitespace-normal px-3 py-2 text-left"
                        onClick={() => onSwitchSchool(membership.schoolId)}
                        disabled={switchingSchool || active}
                        aria-current={active ? "true" : undefined}
                      >
                        <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        <span className="grid min-w-0 flex-1 gap-1">
                          <span className="break-words font-medium">{membership.school.name}</span>
                          <span className="text-xs font-normal text-muted-foreground">{roleLabel(membership.role)}</span>
                        </span>
                        {active ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Escola ativa" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      </Button>
                    );
                  })}
                </div>

                {switchingSchool && <p className="text-sm text-muted-foreground" role="status">A mudar de escola…</p>}
                {switchError && <p className="text-sm text-destructive" role="alert">{switchError}</p>}

                {appRole === "ADMIN" && (
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    render={<Link href="/admin#schools-manager-title" onClick={() => { setSchoolDialogOpen(false); if (isMobile) setOpenMobile(false); }} />}
                  >
                    <Plus /> Criar nova escola
                  </Button>
                )}
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>

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
