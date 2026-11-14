import Link from "next/link";
import { Building2, CalendarDays, School, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AdminRoute = "users" | "schools" | "my-school" | "closed-periods";

const routes = [
  { id: "users", href: "/admin", label: "Utilizadores", icon: Users },
  { id: "schools", href: "/admin/schools", label: "Escolas", icon: Building2 },
  { id: "my-school", href: "/admin/my-school", label: "Minha escola", icon: School },
  { id: "closed-periods", href: "/admin/closed-periods", label: "Fecho de períodos", icon: CalendarDays },
];

export function AdminRouteNav({ current }: { current: AdminRoute }) {
  return (
    <Card className="w-full shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2" role="navigation" aria-label="Administração">
          {routes.map((route) => {
            const isCurrent = current === route.id;
            const Icon = route.icon;
            return (
              <Button
                key={route.id}
                variant="outline"
                className={`h-10 max-w-full min-w-0 flex-none gap-2 whitespace-normal px-3 ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}
                render={<Link href={route.href} aria-current={isCurrent ? "page" : undefined} />}
              >
                <Icon className="size-4 shrink-0" /> <span className="min-w-0 break-words">{route.label}</span>
              </Button>
            );
          })}
      </CardContent>
    </Card>
  );
}