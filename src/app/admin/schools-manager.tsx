"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Building2, Plus, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SchoolMembership = {
  schoolId: string;
  role: string;
  school: { id: string; name: string };
};

type SchoolForm = {
  name: string;
  address: string;
  website: string;
  activationCode: string;
};

const emptyForm: SchoolForm = { name: "", address: "", website: "", activationCode: "" };

export function SchoolsManager() {
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/schools/active", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as escolas.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setMemberships(result.memberships ?? []);
        setActiveSchoolId(result.activeSchoolId ?? null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as escolas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          website: form.website.trim(),
          activationCode: form.activationCode.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar a escola.");

      setForm(emptyForm);
      setSuccess(`“${result.school.name}” foi criada. Esta escola está agora ativa.`);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível criar a escola.");
    } finally {
      setSaving(false);
    }
  }

  async function activateSchool(schoolId: string) {
    setError("");
    const response = await fetch("/api/schools/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? "Não foi possível mudar de escola.");
      return;
    }
    window.location.reload();
  }

  return (
    <section id="schools-manager-title" className="grid gap-4" aria-labelledby="schools-heading">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><Building2 className="size-5" /></span>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Multi-escola</p>
          <h2 id="schools-heading" className="text-xl font-semibold tracking-tight">Escolas</h2>
          <p className="text-sm text-muted-foreground">Adicione escolas e mantenha os respetivos dados e acessos separados.</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="secondary" className="gap-1.5"><School /> Acesso da sua conta</Badge>
              <CardTitle className="pt-1">Escolas disponíveis</CardTitle>
            </div>
            <Badge variant="outline" aria-label={`${memberships.length} escolas disponíveis`}>
              {loading ? "…" : memberships.length}
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground" role="status">A carregar escolas…</p>
            ) : memberships.length ? (
              <ul className="grid gap-2">
                {memberships.map((membership) => {
                  const active = membership.schoolId === activeSchoolId;
                  const role = membership.role === "ADMIN" ? "Administrador" : membership.role === "DIRECCAO" ? "Direção" : "Coordenador";
                  return (
                    <li className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-3" key={membership.schoolId}>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true"><Building2 className="size-4" /></span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <strong className="truncate text-sm font-medium">{membership.school.name}</strong>
                        <span className="text-xs text-muted-foreground">{role}</span>
                      </span>
                      {active ? (
                        <Badge variant="secondary" className="shrink-0 gap-1"><BadgeCheck /> Ativa</Badge>
                      ) : (
                        <Button variant="outline" size="sm" className="shrink-0" type="button" onClick={() => void activateSchool(membership.schoolId)}>
                          Ativar <ArrowRight />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ainda não existem escolas associadas à sua conta.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit gap-1.5"><Plus /> Nova escola</Badge>
            <CardTitle className="pt-1">Registar escola</CardTitle>
            <CardDescription>A sua conta receberá acesso de administrador. Os alunos e as turmas começam vazios nesta escola.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="school-name">Nome da escola <span className="text-destructive">*</span></Label>
                <Input
                  id="school-name"
                  autoComplete="organization"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  maxLength={160}
                  placeholder="Ex.: Escola Secundária Central"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-address">Morada <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="school-address"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  maxLength={300}
                  placeholder="Rua, cidade"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-website">Website <span className="text-muted-foreground">(opcional)</span></Label>
                <Input
                  id="school-website"
                  type="url"
                  autoComplete="url"
                  value={form.website}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  maxLength={300}
                  placeholder="https://escola.ao"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="school-activation-code">Código de ativação <span className="text-destructive">*</span></Label>
                <Input
                  id="school-activation-code"
                  type="password"
                  autoComplete="off"
                  value={form.activationCode}
                  onChange={(event) => setForm((current) => ({ ...current, activationCode: event.target.value }))}
                  maxLength={80}
                  placeholder="Código fornecido pelo suporte"
                  required
                />
                <p className="text-xs text-muted-foreground">Cada código permite registar apenas uma escola.</p>
              </div>

              {error && <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
              {success && <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-primary" role="status">{success}</p>}

              <Button className="w-full" type="submit" disabled={saving || !form.name.trim() || !form.activationCode.trim()}>
                <Plus /> {saving ? "A registar…" : "Adicionar escola"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
