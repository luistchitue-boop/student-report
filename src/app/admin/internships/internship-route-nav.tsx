import Link from "next/link";
import { ClipboardList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type InternshipRoute = "classes" | "reports";

const routes = [
  { id: "classes", href: "/admin/internships", label: "Configurar turmas", icon: ClipboardList },
  { id: "reports", href: "/admin/internship-reports", label: "Relatórios e envios", icon: FileText },
] as const;

export function InternshipRouteNav({ current }: { current: InternshipRoute }) {
  return (
    <nav aria-label="Administração de estágio" className="flex w-fit max-w-full overflow-x-auto pb-1">
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