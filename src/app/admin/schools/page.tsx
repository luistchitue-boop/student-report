import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getSchoolContext } from "@/lib/school-context";
import { AdminRouteNav } from "../admin-route-nav";
import { SchoolsManager } from "../schools-manager";

export default async function AdminSchoolsPage() {
  const session = await auth();
  const schoolContext = session?.user?.id ? await getSchoolContext(session.user.id) : null;

  if (!session?.user || !schoolContext || schoolContext.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AppShell active="admin">
      <main className="main-content admin-page-content">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Multi-escola</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Escolas</h1>
        </header>

        <AdminRouteNav current="schools" />
        <SchoolsManager />
      </main>
    </AppShell>
  );
}