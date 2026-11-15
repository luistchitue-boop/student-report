import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeaderCard } from "@/components/page-header-card";
import { getRootAdmin } from "@/lib/root-admin";
import { RootSchoolsClient } from "./root-schools-client";

export default async function RootPage() {
  const root = await getRootAdmin();
  if (!root) redirect("/");
  return (
    <AppShell active="root">
      <main className="main-content admin-page-content">
        <PageHeaderCard badge="Administração global" title="Gestão de escolas" description="Gira o acesso, os relatórios e os administradores de cada escola." icon={ShieldCheck} />
        <RootSchoolsClient />
      </main>
    </AppShell>
  );
}
