import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <main className="main-content admin-page-content">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
          <CardContent className="flex items-start gap-4 p-5 sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><CalendarDays className="size-5" /></span>
            <div className="grid gap-1">
              <Badge variant="secondary" className="w-fit">Administração</Badge>
              <h1 className="pt-1 text-2xl font-bold tracking-tight sm:text-3xl">Fecho de períodos</h1>
              <p className="text-sm text-muted-foreground">Gira os períodos semanais e os fechos mensais por turma.</p>
            </div>
          </CardContent>
        </Card>
        <AdminRouteNav current="closed-periods" />
        <ClosedPeriodsManager />
      </main>
    </AppShell>
  );
}
