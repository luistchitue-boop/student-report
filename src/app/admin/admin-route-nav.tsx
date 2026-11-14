import Link from "next/link";
import { Button } from "@/components/ui/button";

type AdminRoute = "users" | "schools" | "closed-periods";

const routes: { id: AdminRoute; href: string; label: string }[] = [
  { id: "users", href: "/admin", label: "Utilizadores" },
  { id: "schools", href: "/admin/schools", label: "Escolas" },
  { id: "closed-periods", href: "/admin/closed-periods", label: "Fecho de períodos" },
];

export function AdminRouteNav({ current }: { current: AdminRoute }) {
  return (
    <nav aria-label="Administração" className="w-full overflow-x-auto">
      <div className="flex w-max min-w-full items-center gap-1 rounded-xl border bg-muted/50 p-1 sm:w-fit">
        {routes.map((route) => {
          const isCurrent = current === route.id;
          return (
            <Button
              key={route.id}
              variant={isCurrent ? "secondary" : "ghost"}
              className="h-9 flex-none px-3"
              render={<Link href={route.href} aria-current={isCurrent ? "page" : undefined} />}
            >
              {route.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}