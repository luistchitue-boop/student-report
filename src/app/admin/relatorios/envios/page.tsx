import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { DeliveryIssuesClient } from "./delivery-issues-client";
import { getSchoolContext } from "@/lib/school-context";

export default async function AdminReportDeliveryIssuesPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") redirect("/");

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
