import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="fixed top-4 right-4 z-20"><ThemeToggle /></div>
      {children}
    </>
  );
}