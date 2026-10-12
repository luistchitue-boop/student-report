import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { DeliveryIssuesClient } from "./delivery-issues-client";

export default async function AdminReportDeliveryIssuesPage() {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") redirect("/");

  return (
    <AppShell active="relatorios">
      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">RELATÓRIOS</p><h1>Estado de entrega dos e-mails</h1></div>
        </header>
        <DeliveryIssuesClient />
      </main>
    </AppShell>
  );
}
