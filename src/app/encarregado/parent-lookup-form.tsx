"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ContactRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ParentLookupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/public/parents/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível encontrar o perfil.");
      }

      router.push(`/encarregado/${result.parentIds[0]}?name=${encodeURIComponent(result.parentName)}`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Não foi possível encontrar o perfil.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="public-page">
      <Card className="public-card">
        <CardHeader>
          <div className="public-card-icon"><ContactRound className="size-5" /></div>
          <p className="public-overline">Acesso público</p>
          <CardTitle className="text-2xl tracking-tight">Atualize os seus contactos</CardTitle>
          <CardDescription className="leading-relaxed">Introduza o nome completo do encarregado para procurar automaticamente em todas as escolas.</CardDescription>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="public-form">
          <div className="grid gap-2">
            <Label htmlFor="guardian-name">Nome completo do encarregado</Label>
            <Input
              id="guardian-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: João Luís Pereira"
              inputMode="text"
              autoComplete="name"
              required
            />
          </div>

          {error && <p className="public-feedback error" role="alert">{error}</p>}

          <Button type="submit" className="h-11 w-full gap-2" disabled={isSubmitting}>
            {isSubmitting ? "A procurar…" : "Continuar"} {!isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </form>
        </CardContent>
      </Card>
    </main>
  );
}
