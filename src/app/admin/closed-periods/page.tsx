import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { ClosedPeriodsManager } from "./closed-periods-manager";
import { AdminRouteNav } from "../admin-route-nav";
import { getSchoolContext } from "@/lib/school-context";

export default async function ClosedPeriodsPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ADMINISTRAÇÃO</p>
            <h1>Fecho de períodos</h1>
          </div>
        </header>

        <AdminRouteNav current="closed-periods" />

        <ClosedPeriodsManager />
      </main>
    </AppShell>
  );
}
