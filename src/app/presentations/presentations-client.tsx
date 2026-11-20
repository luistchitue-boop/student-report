"use client";

import { useState } from "react";
import { BookOpen, Calculator, FileImage, FlaskConical, FolderOpen, Globe2, History, ImagePlus, Languages, LoaderCircle, Palette, Play, Plus, Presentation, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PresentationPlayer } from "./presentation-player";
import { getPresentationTemplate, PRESENTATION_TEMPLATES, type TemplateId } from "@/lib/presentation-templates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Turma = { id: string; name: string; subjects: string[] };
type Slide = { title: string; bullets: string[]; speakerNotes?: string; imageData?: string };
type Plan = { title: string; slides: Slide[] };
type Design = { coverBackgroundColor: string; coverTextColor: string; backgroundColor: string; headingColor: string; textColor: string; accentColor: string; coverImageData?: string };
type Props = { turmas: Turma[] };

const inputClass = "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const labelClass = "text-sm font-medium";
const palettes = [
  { name: "Verde natural", coverBackgroundColor: "#173044", coverTextColor: "#FFFFFF", backgroundColor: "#F8FAFC", headingColor: "#173044", textColor: "#263746", accentColor: "#39755D" },
  { name: "Azul oceano", coverBackgroundColor: "#102A43", coverTextColor: "#FFFFFF", backgroundColor: "#F1F7FB", headingColor: "#123B5D", textColor: "#26394A", accentColor: "#1F8AAB" },
  { name: "Terracota", coverBackgroundColor: "#3D2925", coverTextColor: "#FFF9F2", backgroundColor: "#FCF7F1", headingColor: "#54352D", textColor: "#403632", accentColor: "#C56A45" },
  { name: "Índigo", coverBackgroundColor: "#27234A", coverTextColor: "#FFFFFF", backgroundColor: "#F6F5FC", headingColor: "#332E68", textColor: "#333248", accentColor: "#7567C8" },
  { name: "Escuro", coverBackgroundColor: "#171C24", coverTextColor: "#FFFFFF", backgroundColor: "#202833", headingColor: "#F1F5F9", textColor: "#E2E8F0", accentColor: "#58C4A5" },
];
const templateIcons = { history: History, mathematics: Calculator, english: Languages, geography: Globe2, science: FlaskConical, portuguese: BookOpen, arts: Palette, general: Presentation };

async function optimizeImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Escolha uma imagem JPEG, PNG ou WebP.");
  if (file.size > 12_000_000) throw new Error("A imagem original deve ter menos de 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / bitmap.width, 1000 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/jpeg", 0.72);
    if (data.length > 850_000) {
      canvas.width = Math.max(1, Math.round(canvas.width * 0.72));
      canvas.height = Math.max(1, Math.round(canvas.height * 0.72));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      data = canvas.toDataURL("image/jpeg", 0.58);
    }
    if (data.length > 850_000) throw new Error("A imagem continua demasiado grande após otimização. Escolha outra imagem.");
    return data;
  } finally {
    bitmap.close();
  }
}

export function PresentationsClient({ turmas }: Props) {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [objectives, setObjectives] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [design, setDesign] = useState<Design>(palettes[0]);
  const [templateId, setTemplateId] = useState<TemplateId>("general");
  const [activeTab, setActiveTab] = useState("plano");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedTurma = turmas.find((turma) => turma.id === turmaId);
  const subjectOptions = Array.from(new Set(turmas.flatMap((turma) => turma.subjects)));
  const template = getPresentationTemplate(templateId);

  async function uploadImage(file: File | undefined, applyImage: (imageData: string) => void) {
    if (!file) return;
    try {
      const imageData = await optimizeImage(file);
      if (new Blob([imageData]).size + estimateImageDataBytes() > 8_000_000) throw new Error("O conjunto de imagens excede o limite de 8 MB. Remova algumas imagens ou escolha imagens menores.");
      applyImage(imageData);
      toast.success("Imagem otimizada e adicionada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    }
  }

  function estimateImageDataBytes() {
    const slideImages = plan?.slides.reduce((total, slide) => total + (slide.imageData ? Math.ceil(slide.imageData.length * 0.75) : 0), 0) ?? 0;
    return slideImages + (design.coverImageData ? Math.ceil(design.coverImageData.length * 0.75) : 0);
  }

  function chooseTemplate(id: TemplateId) {
    setTemplateId(id);
    const selected = getPresentationTemplate(id);
    setDesign((current) => ({
      ...current,
      coverBackgroundColor: selected.colors.cover,
      coverTextColor: "#FFFFFF",
      backgroundColor: selected.colors.surface,
      headingColor: selected.colors.ink,
      textColor: selected.colors.ink,
      accentColor: selected.colors.accent,
    }));
  }

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
        body: JSON.stringify({ topic, subject, level, objectives, turmaId, slideCount, templateId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível gerar o guião.");
      setPlan({ title: result.title, slides: result.slides });
      toast.success("Apresentação criada. Reveja os diapositivos e comece quando estiver pronta.");
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

  function startPresentation() {
    if (plan) setIsPresenting(true);
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
      <div className="grid gap-6">
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-5 text-primary" /> Escolher modelo</CardTitle><CardDescription>Selecione um tema visual e didático para a sua disciplina. Pode trocar de modelo quando quiser.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {PRESENTATION_TEMPLATES.map((item) => {
            const TemplateIcon = templateIcons[item.id];
            const selected = templateId === item.id;
            return <button key={item.id} type="button" aria-pressed={selected} onClick={() => chooseTemplate(item.id)} className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: item.colors.cover, color: item.colors.accent }}><TemplateIcon className="size-5" /></span>
              <span className="grid min-w-0 gap-1"><span className="flex items-center gap-2 text-sm font-semibold">{item.name}{selected && <span className="text-[10px] font-medium text-primary">ATIVO</span>}</span><span className="text-xs leading-relaxed text-muted-foreground">{item.subject} · {item.description}</span></span>
            </button>;
          })}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Preparar apresentação</CardTitle>
          <CardDescription>Indique o contexto da aula. A IA propõe os diapositivos para rever antes de começar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2"><span className={labelClass}>Tema da aula <span className="text-destructive">*</span></span><input className={inputClass} maxLength={180} placeholder="Ex.: Ciclo da água" value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Disciplina <span className="text-destructive">*</span></span><input className={inputClass} list="presentation-subjects" maxLength={120} placeholder="Ex.: Ciências da Natureza" value={subject} onChange={(event) => setSubject(event.target.value)} /><datalist id="presentation-subjects">{subjectOptions.map((option) => <option key={option} value={option} />)}</datalist></label>
          <label className="grid gap-2"><span className={labelClass}>Classe / nível <span className="text-destructive">*</span></span><input className={inputClass} maxLength={120} placeholder="Ex.: 7.ª classe" value={level} onChange={(event) => setLevel(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Turma (opcional)</span><select className={inputClass} value={turmaId} onChange={(event) => setTurmaId(event.target.value)}><option value="">Sem turma específica</option>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}</select></label>
          {selectedTurma && selectedTurma.subjects.length > 0 && <p className="-mt-2 text-xs text-muted-foreground">Disciplinas desta turma: {selectedTurma.subjects.join(", ")}</p>}
          <label className="grid gap-2"><span className={labelClass}>Objetivos de aprendizagem <span className="font-normal text-muted-foreground">(opcional)</span></span><Textarea maxLength={1200} rows={3} placeholder="O que os alunos deverão compreender ou conseguir fazer?" value={objectives} onChange={(event) => setObjectives(event.target.value)} /></label>
          <label className="grid gap-2"><span className={labelClass}>Diapositivos, incluindo capa</span><select className={inputClass} value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))}>{[4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => <option key={count} value={count}>{count} diapositivos</option>)}</select></label>
          <Button type="button" className="mt-1 w-full" onClick={generate} disabled={generating}>{generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {generating ? "A criar apresentação…" : plan ? "Gerar nova apresentação" : "Criar apresentação"}</Button>
          <p className="text-xs leading-relaxed text-muted-foreground">O conteúdo é uma proposta pedagógica. Reveja os factos e adapte-o à sua turma antes de utilizar.</p>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="size-5 text-primary" /> Personalizar o design</CardTitle>
          <CardDescription>Escolha uma paleta ou ajuste as cores. Pode também adicionar imagens à capa e aos diapositivos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex flex-wrap gap-2" aria-label="Paletas de cores">
            {palettes.map((palette) => <Button key={palette.name} type="button" size="sm" variant="outline" className={`gap-2 ${design.accentColor === palette.accentColor ? "border-primary ring-1 ring-primary/30" : ""}`} onClick={() => setDesign((current) => ({ ...current, ...palette }))}>
              <span className="flex -space-x-1"><span className="size-4 rounded-full border" style={{ backgroundColor: palette.coverBackgroundColor }} /><span className="size-4 rounded-full border" style={{ backgroundColor: palette.accentColor }} /><span className="size-4 rounded-full border" style={{ backgroundColor: palette.backgroundColor }} /></span>{palette.name}
            </Button>)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {([
              ["Fundo da capa", "coverBackgroundColor"],
              ["Texto da capa", "coverTextColor"],
              ["Fundo dos diapositivos", "backgroundColor"],
              ["Títulos", "headingColor"],
              ["Texto", "textColor"],
              ["Destaques", "accentColor"],
            ] as const).map(([label, key]) => <label key={key} className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<input aria-label={label} type="color" className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background p-1" value={design[key]} onChange={(event) => setDesign((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))} /></label>)}
          </div>
          <div className="grid gap-2 border-t pt-4">
            <label className={labelClass} htmlFor="presentation-cover-image">Imagem de capa <span className="font-normal text-muted-foreground">(opcional)</span></label>
            <div className="flex flex-wrap items-center gap-3">
              <input id="presentation-cover-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadImage(event.target.files?.[0], (imageData) => setDesign((current) => ({ ...current, coverImageData: imageData }))); event.currentTarget.value = ""; }} />
              <Button type="button" variant="outline" render={<label htmlFor="presentation-cover-image" className="cursor-pointer" />}><ImagePlus /> Escolher imagem</Button>
              {design.coverImageData && <><div role="img" aria-label="Pré-visualização da imagem de capa" className="size-12 rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url("${design.coverImageData}")` }} /><Button type="button" variant="ghost" size="icon-sm" aria-label="Remover imagem da capa" onClick={() => setDesign((current) => ({ ...current, coverImageData: undefined }))}><X /></Button></>}
            </div>
              <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP; será otimizada para ser apresentada.</p>
          </div>
        </CardContent>
      </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => { if (value) setActiveTab(value); }} className="min-w-0 gap-5">
      <Card className="shadow-sm">
        <CardContent className="px-3 py-1.5 sm:px-4 sm:py-2">
          <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-2 bg-transparent p-0" aria-label="Secções das apresentações">
            <TabsTrigger value="plano" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><BookOpen className="size-4 shrink-0" /><span className="min-w-0 break-words">Plano de aulas</span></TabsTrigger>
            <TabsTrigger value="ficheiros" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><FolderOpen className="size-4 shrink-0" /><span className="min-w-0 break-words">Os meus ficheiros</span></TabsTrigger>
            <TabsTrigger value="apresentacoes" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><Presentation className="size-4 shrink-0" /><span className="min-w-0 break-words">As minhas apresentações</span>{plan && <Badge variant="secondary" className="ml-1">1</Badge>}</TabsTrigger>
          </TabsList>
        </CardContent>
      </Card>
      <TabsContent value="plano" className="min-w-0">
      <section className="grid gap-4" aria-label="Pré-visualização da apresentação">
        {!plan && <Card className="flex min-h-72 items-center justify-center border-dashed bg-card/60 shadow-none"><CardContent className="flex max-w-sm flex-col items-center gap-3 pt-6 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Presentation className="size-6" /></span><p className="font-medium">A apresentação aparece aqui</p><p className="text-sm text-muted-foreground">Escolha um modelo, crie o conteúdo e reveja os diapositivos antes de começar a apresentar.</p></CardContent></Card>}
        {plan && <>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><Badge variant="secondary" className="mb-2">{plan.slides.length + 1} diapositivos · {template.name}</Badge><CardTitle className="text-lg">Rever conteúdo</CardTitle><CardDescription>Edite títulos, pontos e imagens antes de apresentar.</CardDescription></div>
              <Button type="button" onClick={startPresentation} disabled={generating}><Play /> Apresentar</Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2" aria-label="Pré-visualização do design">
                <div className="relative flex min-h-36 overflow-hidden rounded-xl p-4" style={{ backgroundColor: design.coverBackgroundColor, color: design.coverTextColor }}>
                  {design.coverImageData && <div aria-hidden="true" className="absolute inset-y-0 right-0 w-2/5 bg-cover bg-center opacity-80" style={{ backgroundImage: `url("${design.coverImageData}")` }} />}
                  <div className="relative z-10 grid content-center gap-2" style={{ maxWidth: design.coverImageData ? "60%" : "100%" }}><span className="text-[10px] uppercase tracking-widest" style={{ color: design.accentColor }}>Capa</span><strong className="line-clamp-2 text-base">{plan.title || "Título da apresentação"}</strong><span className="text-xs opacity-80">{subject || "Disciplina"} · {level || "Nível"}</span></div>
                </div>
                <div className="relative min-h-36 overflow-hidden rounded-xl border p-4" style={{ backgroundColor: design.backgroundColor, color: design.textColor }}>
                  {plan.slides[0]?.imageData && <div aria-hidden="true" className="absolute inset-y-0 right-0 w-2/5 bg-cover bg-center" style={{ backgroundImage: `url("${plan.slides[0].imageData}")` }} />}
                  <div className="relative z-10 grid content-center gap-2" style={{ maxWidth: plan.slides[0]?.imageData ? "60%" : "100%" }}><span className="text-[10px] uppercase tracking-widest" style={{ color: design.accentColor }}>Diapositivo</span><strong className="line-clamp-1 text-sm" style={{ color: design.headingColor }}>{plan.slides[0]?.title || "Título"}</strong><span className="line-clamp-2 text-xs">{plan.slides[0]?.bullets[0] || "Os pontos principais aparecem aqui."}</span></div>
                </div>
              </div>
              <label className="grid gap-2"><span className={labelClass}>Título da apresentação</span><input className={inputClass} maxLength={120} value={plan.title} onChange={(event) => setPlan({ ...plan, title: event.target.value })} /></label>
              {plan.slides.map((slide, index) => <article key={index} className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3"><Badge variant="outline">Diapositivo {index + 2}</Badge><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover diapositivo ${index + 2}`} onClick={() => setPlan({ ...plan, slides: plan.slides.filter((_, slideIndex) => slideIndex !== index) })} disabled={plan.slides.length <= 2}><Trash2 className="size-4" /></Button></div>
                <label className="grid gap-2"><span className={labelClass}>Título</span><input className={inputClass} maxLength={100} value={slide.title} onChange={(event) => updateSlide(index, { title: event.target.value })} /></label>
                <div className="grid gap-2"><span className={labelClass}>Pontos principais</span>{slide.bullets.map((bullet, bulletIndex) => <div key={bulletIndex} className="flex items-start gap-2"><Textarea rows={2} maxLength={240} aria-label={`Ponto ${bulletIndex + 1} do diapositivo ${index + 2}`} value={bullet} onChange={(event) => updateBullet(index, bulletIndex, event.target.value)} /><Button type="button" variant="ghost" size="icon-sm" className="mt-1 shrink-0" aria-label={`Remover ponto ${bulletIndex + 1}`} onClick={() => updateSlide(index, { bullets: slide.bullets.filter((_, currentIndex) => currentIndex !== bulletIndex) })}><Trash2 className="size-4" /></Button></div>)}{slide.bullets.length < 6 && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => addBullet(index)}><Plus /> Adicionar ponto</Button>}</div>
                <div className="grid gap-2">
                  <span className={labelClass}>Imagem do diapositivo <span className="font-normal text-muted-foreground">(opcional)</span></span>
                  <div className="flex flex-wrap items-center gap-3">
                    <input id={`presentation-slide-image-${index}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadImage(event.target.files?.[0], (imageData) => updateSlide(index, { imageData })); event.currentTarget.value = ""; }} />
                    <Button type="button" variant="outline" size="sm" render={<label htmlFor={`presentation-slide-image-${index}`} className="cursor-pointer" />}><ImagePlus /> Escolher imagem</Button>
                    {slide.imageData && <><div role="img" aria-label={`Pré-visualização da imagem do diapositivo ${index + 2}`} className="size-12 rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url("${slide.imageData}")` }} /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover imagem do diapositivo ${index + 2}`} onClick={() => updateSlide(index, { imageData: undefined })}><X /></Button></>}
                  </div>
                </div>
                <label className="grid gap-2"><span className={labelClass}>Notas do apresentador <span className="font-normal text-muted-foreground">(opcional)</span></span><Textarea rows={2} maxLength={800} value={slide.speakerNotes ?? ""} onChange={(event) => updateSlide(index, { speakerNotes: event.target.value })} /></label>
              </article>)}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={generate} disabled={generating}><RotateCcw /> {generating ? "A gerar…" : "Gerar novamente"}</Button><Button type="button" onClick={startPresentation} disabled={generating}><Play /> Começar apresentação</Button></div>
            </CardContent>
          </Card>
        </>}
      </section>
      </TabsContent>
      <TabsContent value="ficheiros" className="min-w-0">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-primary" /> Os meus ficheiros</CardTitle><CardDescription>Imagens adicionadas à capa e aos diapositivos do rascunho desta sessão.</CardDescription></CardHeader>
          <CardContent>
            {[
              ...(design.coverImageData ? [{ name: "Imagem da capa", location: plan?.title || "Apresentação atual", imageData: design.coverImageData }] : []),
              ...(plan?.slides.flatMap((slide, index) => slide.imageData ? [{ name: slide.title || `Diapositivo ${index + 2}`, location: `Diapositivo ${index + 2}`, imageData: slide.imageData }] : []) ?? []),
            ].length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
              ...(design.coverImageData ? [{ name: "Imagem da capa", location: plan?.title || "Apresentação atual", imageData: design.coverImageData }] : []),
              ...(plan?.slides.flatMap((slide, index) => slide.imageData ? [{ name: slide.title || `Diapositivo ${index + 2}`, location: `Diapositivo ${index + 2}`, imageData: slide.imageData }] : []) ?? []),
            ].map((file, index) => <article key={`${file.location}-${index}`} className="overflow-hidden rounded-xl border bg-card"><div role="img" aria-label={file.name} className="aspect-video bg-cover bg-center" style={{ backgroundImage: `url("${file.imageData}")` }} /><div className="grid gap-1 p-3"><p className="truncate text-sm font-medium">{file.name}</p><p className="truncate text-xs text-muted-foreground">{file.location}</p></div></article>)}</div> : <div className="grid min-h-56 place-content-center justify-items-center gap-3 rounded-xl border border-dashed p-6 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><FileImage className="size-5" /></span><p className="font-medium">Ainda não adicionou ficheiros</p><p className="max-w-md text-sm text-muted-foreground">As imagens escolhidas no Plano de aulas aparecem aqui. Os ficheiros ficam associados ao rascunho desta sessão e não são guardados no servidor.</p><Button type="button" variant="outline" onClick={() => setActiveTab("plano")}><ImagePlus /> Adicionar imagens</Button></div>}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="apresentacoes" className="min-w-0">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-5 text-primary" /> As minhas apresentações</CardTitle><CardDescription>Apresentações criadas nesta sessão de trabalho.</CardDescription></CardHeader>
          <CardContent>
            {plan ? <article className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: template.colors.cover, color: template.colors.accent }}><Presentation className="size-5" /></span><div className="min-w-0"><p className="truncate font-semibold">{plan.title}</p><p className="truncate text-sm text-muted-foreground">{subject || template.subject} · {template.name} · {plan.slides.length + 1} diapositivos</p><Badge variant="outline" className="mt-2">Rascunho desta sessão</Badge></div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setActiveTab("plano")}><BookOpen /> Editar</Button><Button type="button" onClick={startPresentation}><Play /> Apresentar</Button></div></article> : <div className="grid min-h-56 place-content-center justify-items-center gap-3 rounded-xl border border-dashed p-6 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Presentation className="size-5" /></span><p className="font-medium">Ainda não criou apresentações</p><p className="max-w-md text-sm text-muted-foreground">Crie um plano de aula e gere os diapositivos. A apresentação ficará disponível aqui enquanto mantiver esta sessão aberta.</p><Button type="button" onClick={() => setActiveTab("plano")}><Plus /> Criar apresentação</Button></div>}
          </CardContent>
        </Card>
      </TabsContent>
      </Tabs>
      {isPresenting && plan && <PresentationPlayer plan={plan} template={template} design={design} onClose={() => setIsPresenting(false)} />}
    </div>
  );
}
