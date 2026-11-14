"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Activity, ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(result.error === "CredentialsSignin"
          ? "E-mail ou palavra-passe inválidos."
          : `Não foi possível iniciar sessão: ${result.error}`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="fixed top-4 right-4 z-20"><ThemeToggle /></div>
      <div className="auth-layout">
        <section className="auth-brand-panel">
          <div className="auth-brand-mark"><Activity className="size-6" /></div>
          <p className="auth-brand-overline">AEPH · PLATAFORMA ESCOLAR</p>
          <h1>Uma visão clara do percurso de cada aluno.</h1>
          <p className="auth-brand-description">Notas, assiduidade e relatórios organizados para apoiar o trabalho de toda a comunidade escolar.</p>
          <div className="auth-brand-footer"><span className="auth-status-dot" /> Acesso seguro à sua escola</div>
        </section>
        <Card className="auth-card">
          <CardHeader className="space-y-2 p-0">
            <div className="auth-mobile-mark"><Activity className="size-5" /></div>
            <CardTitle className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</CardTitle>
            <CardDescription>Entre com as credenciais da sua conta escolar.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="username" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Palavra-passe</Label>
                  <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <Input id="password" type="password" autoComplete="current-password" placeholder="A sua palavra-passe" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} />
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <Button type="submit" className="mt-1 h-11 w-full gap-2" disabled={loading}>
                {loading ? "A entrar…" : "Entrar na plataforma"}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
            <div className="auth-footer">Precisa de uma conta? Contacte o administrador da escola.</div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
