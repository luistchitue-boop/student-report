"use client";

import { useState } from "react";
import { Download, LoaderCircle, Plus, Presentation, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Turma = { id: string; name: string; subjects: string[] };
type Slide = { title: string; bullets: string[]; speakerNotes?: string };
type Plan = { title: string; slides: Slide[] };
type Props = { turmas: Turma[] };

const inputClass = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const labelClass = "text-sm font-medium";

export function PresentationsClient({ turmas }: Props) {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [objectives, setObjectives] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectedTurma = turmas.find((turma) => turma.id === turmaId);
  const subjectOptions = Array.from(new Set(turmas.flatMap((turma) => turma.subjects)));

  async function generate() {
    if (!topic.trim() || !subject.trim() || !level.trim()) {
      toast.error("Preencha o tema, a disciplina e o nível de ensino.");
      return;
    }
    setGenerating(true);
    setPlan(null);
    try {
      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, subject, level, objectives, turmaId, slideCount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível gerar o guião.");
      setPlan({ title: result.title, slides: result.slides });
      toast.success("Guião criado. Reveja e edite antes de descarregar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocorreu um erro ao gerar a apresentação.");
    } finally {
      setGenerating(false);
    }
  }

  function updateSlide(index: number, patch: Partial<Slide>) {
    setPlan((current) => current ? { ...current, slides: current.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide) } : current);
  }

  function updateBullet(index: number, bulletIndex: number, value: string) {
    setPlan((current) => current ? { ...current, slides: current.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, bullets: slide.bullets.map((bullet, currentBulletIndex) => currentBulletIndex === bulletIndex ? value : bullet) } : slide) } : current);
  }

  function addBullet(index: number) {
    setPlan((current) => current ? { ...current, slides: current.slides.map((slide, slideIndex) => slideIndex === index && slide.bullets.length < 6 ? { ...slide, bullets: [...slide.bullets, ""] } : slide) } : current);
  }

  async function download() {
    if (!plan) return;
    setDownloading(true);
    try {
      const response = await fetch("/api/presentations/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, subject, level, turmaId }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Não foi possível criar o ficheiro PowerPoint.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${plan.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "apresentacao"}.pptx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Apresentação descarregada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ocorreu um erro ao descarregar.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Preparar apresentação</CardTitle>
          <CardDescription>Indique o contexto da aula. A IA propõe os diapositivos para rever antes do download.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2"><span className={labelClass}>Tema da aula <span className="text-destructive">*</span></span><input className={inputClass} maxLength={180} placeholder="Ex.: Ciclo da água" value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Disciplina <span className="text-destructive">*</span></span><input className={inputClass} list="presentation-subjects" maxLength={120} placeholder="Ex.: Ciências da Natureza" value={subject} onChange={(event) => setSubject(event.target.value)} /><datalist id="presentation-subjects">{subjectOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
          <label className="grid gap-2"><span className={labelClass}>Classe / nível <span className="text-destructive">*</span></span><input className={inputClass} maxLength={120} placeholder="Ex.: 7.ª classe" value={level} onChange={(event) => setLevel(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Turma (opcional)</span><select className={inputClass} value={turmaId} onChange={(event) => setTurmaId(event.target.value)}><option value="">Sem turma específica</option>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}</select></label>
          {selectedTurma && selectedTurma.subjects.length > 0 && <p className="-mt-2 text-xs text-muted-foreground">Disciplinas desta turma: {selectedTurma.subjects.join(", ")}</p>}
          <label className="grid gap-2"><span className={labelClass}>Objetivos de aprendizagem <span className="font-normal text-muted-foreground">(opcional)</span></span><Textarea maxLength={1200} rows={3} placeholder="O que os alunos deverão compreender ou conseguir fazer?" value={objectives} onChange={(event) => setObjectives(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Diapositivos, incluindo capa</span><select className={inputClass} value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))}>{[4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => <option key={count} value={count}>{count} diapositivos</option>)}</select></label>
          <Button type="button" className="mt-1 w-full" onClick={generate} disabled={generating || downloading}>{generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {generating ? "A criar guião…" : plan ? "Gerar novo guião" : "Gerar guião"}</Button>
          <p className="text-xs leading-relaxed text-muted-foreground">O conteúdo é uma proposta pedagógica. Reveja os factos e adapte-o à sua turma antes de utilizar.</p>
        </CardContent>
      </Card>

      <section className="grid gap-4" aria-label="Pré-visualização da apresentação">
        {!plan && <Card className="flex min-h-72 items-center justify-center border-dashed bg-card/60 shadow-none"><CardContent className="flex max-w-sm flex-col items-center gap-3 pt-6 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Presentation className="size-6" /></span><p className="font-medium">O guião aparece aqui</p><p className="text-sm text-muted-foreground">Depois de gerado, pode editar títulos e pontos de cada diapositivo antes de descarregar o PowerPoint.</p></CardContent></Card>}
        {plan && <>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><Badge variant="secondary" className="mb-2">{plan.slides.length + 1} diapositivos</Badge><CardTitle className="text-lg">Rever conteúdo</CardTitle><CardDescription>Edite os campos abaixo. A capa utiliza o título da apresentação.</CardDescription></div>
              <Button type="button" onClick={download} disabled={downloading || generating}>{downloading ? <LoaderCircle className="animate-spin" /> : <Download />} {downloading ? "A preparar…" : "Descarregar .pptx"}</Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2"><span className={labelClass}>Título da apresentação</span><input className={inputClass} maxLength={120} value={plan.title} onChange={(event) => setPlan({ ...plan, title: event.target.value })} /></label>
              {plan.slides.map((slide, index) => <article key={index} className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3"><Badge variant="outline">Diapositivo {index + 2}</Badge><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover diapositivo ${index + 2}`} onClick={() => setPlan({ ...plan, slides: plan.slides.filter((_, slideIndex) => slideIndex !== index) })} disabled={plan.slides.length <= 2}><Trash2 className="size-4" /></Button></div>
                <label className="grid gap-2"><span className={labelClass}>Título</span><input className={inputClass} maxLength={100} value={slide.title} onChange={(event) => updateSlide(index, { title: event.target.value })} /></label>
                <div className="grid gap-2"><span className={labelClass}>Pontos principais</span>{slide.bullets.map((bullet, bulletIndex) => <div key={bulletIndex} className="flex items-start gap-2"><Textarea rows={2} maxLength={240} aria-label={`Ponto ${bulletIndex + 1} do diapositivo ${index + 2}`} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} /><Button type="button" variant="ghost" size="icon-sm" className="mt-1 shrink-0" aria-label={`Remover ponto ${bulletIndex + 1}`} onClick={() => updateSlide(index, { bullets: slide.bullets.filter((_, currentIndex) => currentIndex !== bulletIndex) })}><Trash2 className="size-4" /></Button></div>)}{slide.bullets.length < 6 && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => addBullet(index)}><Plus /> Adicionar ponto</Button>}</div>
                <label className="grid gap-2"><span className={labelClass}>Notas do apresentador <span className="font-normal text-muted-foreground">(opcional)</span></span><Textarea rows={2} maxLength={800} value={slide.speakerNotes ?? ""} onChange={(event) => updateSlide(index, { speakerNotes: event.target.value })} /></label>
              </article>)}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={generate} disabled={generating || downloading}><RotateCcw /> {generating ? "A gerar…" : "Gerar novamente"}</Button><Button type="button" onClick={download} disabled={downloading || generating}>{downloading ? <LoaderCircle className="animate-spin" /> : <Download />} Descarregar PowerPoint</Button></div>
            </CardContent>
          </Card>
        </>}
      </section>
    </div>
  );
}
