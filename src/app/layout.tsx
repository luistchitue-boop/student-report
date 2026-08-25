import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEph Reports | WhatsApp delivery",
  description: "Send student PDF reports to families via WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
