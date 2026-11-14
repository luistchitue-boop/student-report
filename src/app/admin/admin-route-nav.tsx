import Link from "next/link";
import { Building2, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminRoute = "users" | "schools" | "closed-periods";

const routes = [
  { id: "users", href: "/admin", label: "Utilizadores", icon: Users },
  { id: "schools", href: "/admin/schools", label: "Escolas", icon: Building2 },
  { id: "closed-periods", href: "/admin/closed-periods", label: "Fecho de períodos", icon: CalendarDays },
];

export function AdminRouteNav({ current }: { current: AdminRoute }) {
  return (
    <nav aria-label="Administração" className="flex w-fit max-w-full overflow-x-auto pb-1">
      <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
        {routes.map((route) => {
          const isCurrent = current === route.id;
          const Icon = route.icon;
          return (
            <Button
              key={route.id}
              variant="ghost"
              className={`h-9 flex-none gap-1.5 rounded-md border px-3 py-0.5 text-sm font-medium whitespace-nowrap transition-all ${isCurrent ? "border-border bg-background text-foreground shadow-sm" : "border-transparent text-foreground/60 hover:text-foreground"}`}
              render={<Link href={route.href} aria-current={isCurrent ? "page" : undefined} />}
            >
              <Icon /> {route.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}