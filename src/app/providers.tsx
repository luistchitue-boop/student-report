"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children, initialTheme }: ProvidersProps & { initialTheme: "light" | "dark" | "system" }) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <SessionProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
