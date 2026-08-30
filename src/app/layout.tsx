import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AEph Reports | Entrega de relatórios",
  description: "Envie relatórios PDF de alunos para famílias por WhatsApp, SMS ou email.",
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
