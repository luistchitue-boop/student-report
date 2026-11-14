import Link from "next/link";
import { ClipboardList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InternshipRoute = "classes" | "reports";

const routes = [
  { id: "classes", href: "/admin/internships", label: "Configurar turmas", icon: ClipboardList },
  { id: "reports", href: "/admin/internship-reports", label: "Relatórios e envios", icon: FileText },
] as const;

export function InternshipRouteNav({ current }: { current: InternshipRoute }) {
  return (
    <Card className="w-full shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2" role="navigation" aria-label="Administração de estágio">
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