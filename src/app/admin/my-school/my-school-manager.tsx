"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Building2, ImagePlus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { StudentIdCards } from "./student-id-cards";

type SchoolProfile = {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  reportEmailTemplate: string | null;
};

const defaultEmailTemplate = "Estimado(a) {{recipientName}},\n\nSegue em anexo o relatório de {{studentName}}, referente ao período {{period}}.\n\nCom os melhores cumprimentos,\n{{schoolName}}";
const templateTokens = ["{{recipientName}}", "{{studentName}}", "{{period}}", "{{schoolName}}"];

function previewTemplate(template: string, schoolName: string) {
  return templateTokens.reduce((text, token) => {
    const values: Record<string, string> = {
      "{{recipientName}}": "Maria José",
      "{{studentName}}": "Ana Manuel",
      "{{period}}": "01/11/2026 a 07/11/2026",
      "{{schoolName}}": schoolName || "Nome da escola",
    };
    return text.split(token).join(values[token]);
  }, template);
}

export function MySchoolManager() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [emailTemplate, setEmailTemplate] = useState(defaultEmailTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/school-profile", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os dados da escola.");
        return result.school as SchoolProfile;
      })
      .then((profile) => {
        if (!active) return;
        setSchool(profile);
        setName(profile.name);
        setAddress(profile.address ?? "");
        setWebsite(profile.website ?? "");
        setEmailTemplate(profile.reportEmailTemplate ?? defaultEmailTemplate);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados da escola.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/school-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, website, reportEmailTemplate: emailTemplate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar os dados da escola.");
      setSchool(result.school);
      window.dispatchEvent(new CustomEvent("active-school-profile-updated", { detail: { schoolId: result.school.id, schoolName: result.school.name } }));
      setSuccess("Os dados da escola e o modelo de e-mail foram guardados.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível guardar os dados da escola.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setUploadingLogo(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/admin/school-profile/logo", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o logótipo.");
      setSchool(result.school);
      setSuccess("O logótipo foi atualizado e será usado nos relatórios PDF.");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível carregar o logótipo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUploadingLogo(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/school-profile/logo", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível remover o logótipo.");
      setSchool(result.school);
      setSuccess("O logótipo da escola foi removido.");
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível remover o logótipo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) {
    return <div className="grid gap-5" role="status" aria-label="A carregar perfil da escola"><Card><CardHeader><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-full max-w-xl" /></CardHeader><CardContent className="grid gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card><Card><CardHeader><Skeleton className="h-6 w-56" /></CardHeader><CardContent><Skeleton className="h-36 w-full" /></CardContent></Card></div>;
  }

  if (!school) return <Card role="alert" className="border-destructive/30 bg-destructive/5"><CardContent className="p-4 text-sm text-destructive">{error || "Não foi possível carregar os dados da escola."}</CardContent></Card>;

  return (
    <section className="grid gap-5" aria-label="Perfil e personalização da escola">
      {error && <Card role="alert" className="border-destructive/30 bg-destructive/5 shadow-none"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {success && <Card role="status" className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="p-4 text-sm text-primary">{success}</CardContent></Card>}

      <form className="grid gap-5" onSubmit={saveProfile}>
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <Badge variant="secondary" className="w-fit gap-1.5"><Building2 /> Perfil da escola ativa</Badge>
            <CardTitle className="pt-1 text-xl">Dados da escola</CardTitle>
            <CardDescription>Estas informações são usadas na plataforma e no cabeçalho dos relatórios PDF.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="my-school-name">Nome da escola</Label>
                <Input id="my-school-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="my-school-address">Morada</Label>
                <Input id="my-school-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} placeholder="Morada da escola" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="my-school-website">Website</Label>
                <Input id="my-school-website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={300} placeholder="https://escola.ao" />
                <p className="text-xs text-muted-foreground">O website será usado para gerar o código QR nos relatórios e cartões de aluno em PDF.</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border bg-background p-2">
                {school.logoUrl ? <Image src={school.logoUrl} alt={`Logótipo de ${school.name}`} width={64} height={64} unoptimized className="max-h-full max-w-full object-contain" /> : <Building2 className="size-8 text-muted-foreground" />}
              </div>
              <div className="grid min-w-0 gap-2">
                <div><p className="text-sm font-medium">Logótipo para PDF</p><p className="text-xs text-muted-foreground">PNG, JPG ou WEBP; máximo 5 MB. É apresentado nos relatórios escolares e de estágio.</p></div>
                <div className="flex flex-wrap gap-2">
                  <Input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingLogo} onChange={(event) => void uploadLogo(event.target.files?.[0])} aria-label="Carregar logótipo da escola" />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}><ImagePlus /> {uploadingLogo ? "A atualizar…" : "Carregar logótipo"}</Button>
                  {school.logoUrl && <Button type="button" variant="ghost" size="sm" disabled={uploadingLogo} onClick={() => void removeLogo()}><Trash2 /> Remover</Button>}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4"><Button type="submit" disabled={saving || uploadingLogo}><Save /> {saving ? "A guardar…" : "Guardar dados da escola"}</Button></div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <Badge variant="secondary" className="w-fit">MODELO DE E-MAIL</Badge>
            <CardTitle className="pt-1 text-xl">Mensagem enviada com os relatórios</CardTitle>
            <CardDescription>Este modelo é usado nos e-mails de relatórios escolares e de estágio. O PDF continua anexado. Deixe vazio para usar a mensagem predefinida.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5">
            <div className="grid gap-2">
              <Label htmlFor="school-email-template">Mensagem</Label>
              <Textarea id="school-email-template" value={emailTemplate} onChange={(event) => setEmailTemplate(event.target.value)} maxLength={5000} rows={8} placeholder={defaultEmailTemplate} />
              <p className="text-xs text-muted-foreground">Variáveis disponíveis: <code>{"{{recipientName}}"}</code>, <code>{"{{studentName}}"}</code>, <code>{"{{period}}"}</code> e <code>{"{{schoolName}}"}</code>. Máximo de 5.000 caracteres.</p>
            </div>
            <div className="grid gap-2 rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
              <p className="whitespace-pre-wrap break-words text-sm">{previewTemplate(emailTemplate || defaultEmailTemplate, name)}</p>
            </div>
          </CardContent>
        </Card>
      </form>
      <StudentIdCards />
    </section>
  );
}
