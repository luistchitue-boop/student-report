import type { Metadata } from "next";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
