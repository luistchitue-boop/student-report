import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type PageHeaderCardProps = {
  badge: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  titleAdornment?: ReactNode;
  action?: ReactNode;
};

export function PageHeaderCard({ badge, title, description, icon: Icon, titleAdornment, action }: PageHeaderCardProps) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <Badge variant="secondary" className="w-fit">{badge}</Badge>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {titleAdornment}
            </div>
            {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{action}</div>}
      </CardContent>
    </Card>
  );
}