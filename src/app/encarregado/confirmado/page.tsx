import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contacto confirmado",
  description: "A alteração dos seus contactos foi confirmada.",
};

export default function ParentContactConfirmedPage() {
  return (
    <main className="public-page">
      <Card className="public-card public-confirmed-card">
        <CardHeader className="items-center text-center">
          <div className="public-confirmed-icon"><BadgeCheck className="size-7" /></div>
          <CardTitle className="text-2xl tracking-tight">Alteração confirmada</CardTitle>
          <CardDescription className="text-sm leading-relaxed">Os seus contactos foram atualizados com sucesso.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-xs text-muted-foreground">Já pode fechar esta página.</CardContent>
      </Card>
    </main>
  );
}
