import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ title = "Painel escolar" }: { title?: string }) {
  return (
    <header className="app-site-header">
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 lg:px-7">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-5" />
        <div className="min-w-0">
          <p className="app-site-kicker">AEPH · RELATÓRIOS</p>
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="ml-auto shrink-0"><ThemeToggle /></div>
      </div>
    </header>
  )
}
