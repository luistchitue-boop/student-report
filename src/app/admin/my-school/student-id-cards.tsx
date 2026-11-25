"use client";

import { useEffect, useState } from "react";
import { Download, Eye, IdCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Turma = { id: string; name: string; students: Array<{ id: string; name: string }> };

export function StudentIdCards() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const selectedTurma = turmas.find((turma) => turma.id === turmaId);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/student-id-cards", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar as turmas.");
        return data.turmas as Turma[];
      })
      .then((data) => setTurmas(data))
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as turmas."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function generatePreview() {
    if (!turmaId) return;
    setGenerating(true);
    setError("");
    setPreviewUrl("");
    try {
      const response = await fetch("/api/admin/student-id-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaId, ...(studentId ? { studentId } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar os cartões.");
      }
      setPreviewUrl(URL.createObjectURL(await response.blob()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar os cartões.");
    } finally {
      setGenerating(false);
    }
  }

  const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b bg-muted/20">
        <Badge variant="secondary" className="w-fit gap-1.5"><IdCard /> IDENTIFICAÇÃO</Badge>
        <CardTitle className="pt-1 text-xl">Cartões de aluno</CardTitle>
        <CardDescription>Pré-visualize e imprima cartões de identificação para um aluno ou para toda a turma. O PDF usa os dados guardados, o logótipo e um código QR para o website da escola, quando disponível.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="id-card-turma">Turma</Label>
            <select id="id-card-turma" className={selectClass} value={turmaId} disabled={loading || generating} onChange={(event) => { setTurmaId(event.target.value); setStudentId(""); setPreviewUrl(""); setError(""); }}>
              <option value="">{loading ? "A carregar turmas…" : "Selecione uma turma"}</option>
              {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name} ({turma.students.length} alunos ativos)</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="id-card-student">Aluno</Label>
            <select id="id-card-student" className={selectClass} value={studentId} disabled={!selectedTurma || generating} onChange={(event) => { setStudentId(event.target.value); setPreviewUrl(""); setError(""); }}>
              <option value="">Todos os alunos ativos</option>
              {selectedTurma?.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>
        </div>
        {!loading && !turmas.length && !error && <p className="text-sm text-muted-foreground">Ainda não existem turmas nesta escola.</p>}
        {selectedTurma && !selectedTurma.students.length && <p className="text-sm text-muted-foreground">Esta turma não tem alunos ativos.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void generatePreview()} disabled={!selectedTurma?.students.length || generating}><Eye /> {generating ? "A gerar PDF…" : "Pré-visualizar PDF"}</Button>
          {previewUrl && <a className={buttonVariants({ variant: "outline" })} href={previewUrl} download="cartoes-de-aluno.pdf"><Download className="size-4" /> Descarregar PDF</a>}
          <span className="text-xs text-muted-foreground">Formato A4 · cartões de 85,6 × 54 mm</span>
        </div>
        {previewUrl && <div className="grid gap-2"><iframe title="Pré-visualização dos cartões de aluno em PDF" src={previewUrl} className="h-[600px] w-full rounded-xl border bg-muted/20" /><p className="text-xs text-muted-foreground">Se a pré-visualização não estiver disponível, descarregue o PDF para o abrir e imprimir.</p></div>}
      </CardContent>
    </Card>
  );
}