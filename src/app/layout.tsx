import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NEPH Relatórios | Gestão escolar",
  description: "Crie e envie relatórios escolares com notas, faltas e observações para as famílias.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value;
  const initialTheme = cookieTheme === "light" || cookieTheme === "dark" || cookieTheme === "system" ? cookieTheme : "system";
  const resolvedThemeCookie = cookieStore.get("resolved-theme")?.value;
  const resolvedTheme = resolvedThemeCookie === "dark" ? "dark" : "light";
  const isDark = initialTheme === "dark" || (initialTheme === "system" && resolvedTheme === "dark");

  return (
    <html lang="pt-PT" className={isDark ? "dark" : undefined} suppressHydrationWarning>
      <body>
        <Providers initialTheme={initialTheme}>{children}</Providers>
      </body>
    </html>
  );
}
