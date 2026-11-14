"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeContextValue>({ theme: "system", setTheme: () => undefined });
const themeCookieMaxAge = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${themeCookieMaxAge}; SameSite=Lax${secure}`;
}

export function ThemeProvider({
  children,
  initialTheme = "system",
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [initialized, setInitialized] = useState(false);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem("theme", nextTheme);
      writeCookie("theme", nextTheme);
    } catch {
      // Theme selection still applies for this session if storage is unavailable.
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const hasServerTheme = document.cookie.split(";").some((cookie) => cookie.trim().startsWith("theme="));
        const storedTheme = window.localStorage.getItem("theme");
        if (!hasServerTheme && (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system")) {
          setThemeState(storedTheme);
          writeCookie("theme", storedTheme);
        }
      } catch {
        // Keep the theme supplied by the server when browser storage is unavailable.
      }
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme: ResolvedTheme = theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.style.colorScheme = resolvedTheme;
      writeCookie("resolved-theme", resolvedTheme);
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [initialized, theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
