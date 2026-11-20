"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Calculator, FileImage, FileText, FlaskConical, FolderOpen, Globe2, History, ImagePlus, Languages, LoaderCircle, Palette, Play, Plus, Presentation, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PresentationPlayer } from "./presentation-player";
import { getPresentationTemplate, PRESENTATION_TEMPLATES, type TemplateId } from "@/lib/presentation-templates";

type Turma = { id: string; name: string; subjects: string[] };
type ResourceFile = { id: string; name: string; url: string; contentType: string; size: number; createdAt: string };
type LessonPlan = { id: string; title: string; lessonNumber: string | null; subject: string; level: string; turmaId: string | null; objectives: string; lessonDetails: string; resourceUrls: string[]; files: ResourceFile[]; updatedAt: string };
type Slide = { title: string; bullets: string[]; speakerNotes?: string; imageData?: string };
type PresentationPlan = { title: string; slides: Slide[] };
type Design = { coverBackgroundColor: string; coverTextColor: string; backgroundColor: string; headingColor: string; textColor: string; accentColor: string; coverImageData?: string };
type Props = { turmas: Turma[] };

type LessonDraft = { title: string; lessonNumber: string; subject: string; level: string; turmaId: string; objectives: string; lessonDetails: string; resourceUrlsText: string; resourceIds: string[] };
const blankLesson: LessonDraft = { title: "", lessonNumber: "", subject: "", level: "", turmaId: "", objectives: "", lessonDetails: "", resourceUrlsText: "", resourceIds: [] };
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
    const data = canvas.toDataURL("image/jpeg", 0.72);
    if (data.length > 850_000) throw new Error("A imagem otimizada excede 850 KB. Escolha outra imagem.");
    return data;
  } finally { bitmap.close(); }
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function LessonWorkspaceClient({ turmas }: Props) {
  const [activeTab, setActiveTab] = useState("planos");
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [draft, setDraft] = useState<LessonDraft>(blankLesson);
  const [editingId, setEditingId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingLesson, setSavingLesson] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("general");
  const [design, setDesign] = useState<Design>(palettes[0]);
  const [slideCount, setSlideCount] = useState(6);
  const [showPresentationOptions, setShowPresentationOptions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [presentation, setPresentation] = useState<PresentationPlan | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const template = getPresentationTemplate(templateId);
  const selectedLesson = lessonPlans.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const subjectOptions = useMemo(() => Array.from(new Set(turmas.flatMap((turma) => turma.subjects))), [turmas]);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [plansResponse, filesResponse] = await Promise.all([
        fetch("/api/lesson-plans", { cache: "no-store" }),
        fetch("/api/presentation-files", { cache: "no-store" }),
      ]);
      const plansResult = await plansResponse.json();
      const filesResult = await filesResponse.json();
      if (!plansResponse.ok) throw new Error(plansResult.error ?? "Não foi possível carregar os planos de aula.");
      if (!filesResponse.ok) throw new Error(filesResult.error ?? "Não foi possível carregar os ficheiros.");
      setLessonPlans(plansResult.lessonPlans ?? []);
      setFiles(filesResult.files ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os dados.");
    } finally { setLoading(false); }
  }

  useEffect(() => { Promise.resolve().then(() => loadWorkspace()); }, []);

  function editLesson(lesson: LessonPlan) {
    setEditingId(lesson.id);
    setDraft({ title: lesson.title, lessonNumber: lesson.lessonNumber ?? "", subject: lesson.subject, level: lesson.level, turmaId: lesson.turmaId ?? "", objectives: lesson.objectives, lessonDetails: lesson.lessonDetails, resourceUrlsText: lesson.resourceUrls.join("\n"), resourceIds: lesson.files.map((file) => file.id) });
    setActiveTab("planos");
  }

  function startNewLesson() {
    setEditingId("");
    setDraft(blankLesson);
  }

  async function saveLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingLesson(true);
    try {
      const resourceUrls = draft.resourceUrlsText.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
      const response = await fetch("/api/lesson-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, resourceUrls, id: editingId || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar o plano.");
      const saved = result.lessonPlan as LessonPlan;
      setLessonPlans((current) => [saved, ...current.filter((lesson) => lesson.id !== saved.id)]);
      setSelectedLessonId(saved.id);
      setEditingId(saved.id);
      toast.success("Plano de aula guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar o plano de aula.");
    } finally { setSavingLesson(false); }
  }

  async function deleteLesson(lesson: LessonPlan) {
    if (!window.confirm(`Eliminar o plano “${lesson.title}”?`)) return;
    const response = await fetch("/api/lesson-plans", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lesson.id }) });
    const result = await response.json();
    if (!response.ok) { toast.error(result.error ?? "Não foi possível eliminar o plano."); return; }
    setLessonPlans((current) => current.filter((item) => item.id !== lesson.id));
    if (selectedLessonId === lesson.id) { setSelectedLessonId(""); setPresentation(null); setShowPresentationOptions(false); }
    if (editingId === lesson.id) startNewLesson();
    toast.success("Plano de aula eliminado.");
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploadingFile(true);
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch("/api/presentation-files", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o ficheiro.");
      setFiles((current) => [result.file, ...current]);
      toast.success("Ficheiro carregado para Os meus ficheiros.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar o ficheiro."); }
    finally { setUploadingFile(false); }
  }

  async function deleteFile(file: ResourceFile) {
    if (!window.confirm(`Eliminar “${file.name}” da biblioteca? Será removido de todos os planos que o utilizam.`)) return;
    setDeletingFileId(file.id);
    try {
      const response = await fetch("/api/presentation-files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível eliminar o ficheiro.");
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setLessonPlans((current) => current.map((lesson) => ({ ...lesson, files: lesson.files.filter((item) => item.id !== file.id) })));
      setDraft((current) => ({ ...current, resourceIds: current.resourceIds.filter((id) => id !== file.id) }));
      toast.success("Ficheiro eliminado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível eliminar o ficheiro."); }
    finally { setDeletingFileId(""); }
  }

  function chooseTemplate(id: TemplateId) {
    setTemplateId(id);
    const selected = getPresentationTemplate(id);
    setDesign((current) => ({ ...current, coverBackgroundColor: selected.colors.cover, coverTextColor: "#FFFFFF", backgroundColor: selected.colors.surface, headingColor: selected.colors.ink, textColor: selected.colors.ink, accentColor: selected.colors.accent }));
  }

  async function createPresentation() {
    if (!selectedLesson) { toast.error("Guarde e selecione um plano de aula antes de criar a apresentação."); return; }
    setGenerating(true);
    setPresentation(null);
    try {
      const response = await fetch("/api/presentations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonPlanId: selectedLesson.id, slideCount, templateId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar a apresentação.");
      setPresentation({ title: result.title, slides: result.slides });
      toast.success("Apresentação criada a partir do plano de aula.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a apresentação."); }
    finally { setGenerating(false); }
  }

  function updateSlide(index: number, patch: Partial<Slide>) {
    setPresentation((current) => current ? { ...current, slides: current.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide) } : current);
  }

  async function addSlideImage(index: number, file: File | undefined) {
    if (!file) return;
    try {
      const imageData = await optimizeImage(file);
      const existing = (presentation?.slides ?? []).reduce((total, slide, slideIndex) => total + (slideIndex !== index && slide.imageData ? Math.ceil(slide.imageData.length * 0.75) : 0), design.coverImageData ? Math.ceil(design.coverImageData.length * 0.75) : 0);
      if (existing + Math.ceil(imageData.length * 0.75) > 8_000_000) throw new Error("As imagens desta apresentação excedem o limite de 8 MB.");
      updateSlide(index, { imageData });
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar a imagem."); }
  }

  async function addCoverImage(file: File | undefined) {
    if (!file) return;
    try {
      const imageData = await optimizeImage(file);
      const slideImages = (presentation?.slides ?? []).reduce((total, slide) => total + (slide.imageData ? Math.ceil(slide.imageData.length * 0.75) : 0), 0);
      if (slideImages + Math.ceil(imageData.length * 0.75) > 8_000_000) throw new Error("As imagens desta apresentação excedem o limite de 8 MB.");
      setDesign((current) => ({ ...current, coverImageData: imageData }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar a imagem."); }
  }

  function toggleResource(resourceId: string) {
    setDraft((current) => ({ ...current, resourceIds: current.resourceIds.includes(resourceId) ? current.resourceIds.filter((id) => id !== resourceId) : [...current.resourceIds, resourceId] }));
  }

  const linkedResources = selectedLesson ? [...selectedLesson.files.map((file) => ({ name: file.name, url: file.url })), ...selectedLesson.resourceUrls.map((url) => ({ name: url, url }))] : [];

  return <div className="grid gap-6">
    <Tabs value={activeTab} onValueChange={(value) => { if (value) setActiveTab(value); }} className="min-w-0 gap-5">
      <Card className="shadow-sm"><CardContent className="px-3 py-1.5 sm:px-4 sm:py-2"><TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-2 bg-transparent p-0" aria-label="Secções das apresentações">
        <TabsTrigger value="planos" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><BookOpen className="size-4 shrink-0" /> Plano de aulas</TabsTrigger>
        <TabsTrigger value="ficheiros" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><FolderOpen className="size-4 shrink-0" /> Os meus ficheiros <Badge variant="secondary">{files.length}</Badge></TabsTrigger>
        <TabsTrigger value="apresentacoes" className="h-10 max-w-full min-w-0 flex-none whitespace-normal border-border bg-background px-3 text-foreground data-active:border-primary/40 data-active:bg-primary/10"><Presentation className="size-4 shrink-0" /> As minhas apresentações {presentation && <Badge variant="secondary">1</Badge>}</TabsTrigger>
      </TabsList></CardContent></Card>

      <TabsContent value="planos" className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <Card className="shadow-sm"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{editingId ? "Editar plano de aula" : "Criar plano de aula"}</CardTitle><CardDescription className="mt-1">Registe o contexto completo da aula. Guarde o plano para o selecionar ao criar uma apresentação.</CardDescription></div><Button type="button" variant="outline" onClick={startNewLesson}><Plus /> Novo plano</Button></div></CardHeader>
          <CardContent><form className="grid gap-4" onSubmit={saveLesson}>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2"><span className={labelClass}>Título da aula *</span><input className={inputClass} required maxLength={180} placeholder="Ex.: As causas da independência de Angola" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="grid gap-2"><span className={labelClass}>Número da aula</span><input className={inputClass} maxLength={80} placeholder="Ex.: 03 ou 03/2026" value={draft.lessonNumber} onChange={(event) => setDraft({ ...draft, lessonNumber: event.target.value })} /></label></div>
            <div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-2"><span className={labelClass}>Disciplina *</span><input className={inputClass} list="lesson-subjects" required maxLength={120} placeholder="Ex.: História" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /><datalist id="lesson-subjects">{subjectOptions.map((item) => <option key={item} value={item} />)}</datalist></label><label className="grid gap-2"><span className={labelClass}>Classe / nível *</span><input className={inputClass} required maxLength={120} placeholder="Ex.: 9.ª classe" value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })} /></label><label className="grid gap-2"><span className={labelClass}>Turma</span><select className={inputClass} value={draft.turmaId} onChange={(event) => setDraft({ ...draft, turmaId: event.target.value })}><option value="">Sem turma específica</option>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}</select></label></div>
            <label className="grid gap-2"><span className={labelClass}>Objetivos de aprendizagem</span><Textarea rows={4} maxLength={8000} placeholder="Descreva o que os alunos deverão saber ou conseguir fazer no fim da aula." value={draft.objectives} onChange={(event) => setDraft({ ...draft, objectives: event.target.value })} /></label>
            <label className="grid gap-2"><span className={labelClass}>Detalhes e sequência da aula</span><Textarea rows={6} maxLength={12000} placeholder="Introdução, explicação, atividades, exemplos, avaliação, adaptações…" value={draft.lessonDetails} onChange={(event) => setDraft({ ...draft, lessonDetails: event.target.value })} /></label>
            <label className="grid gap-2"><span className={labelClass}>Recursos e URLs</span><Textarea rows={3} placeholder="Adicione um endereço HTTP/HTTPS por linha." value={draft.resourceUrlsText} onChange={(event) => setDraft({ ...draft, resourceUrlsText: event.target.value })} /><span className="text-xs text-muted-foreground">Pode associar ficheiros carregados no separador Os meus ficheiros abaixo.</span></label>
            <div className="grid gap-2"><div className="flex items-center justify-between gap-2"><span className={labelClass}>Ficheiros associados</span><Button type="button" size="sm" variant="outline" onClick={() => setActiveTab("ficheiros")}><Upload /> Carregar ficheiros</Button></div>
              {files.length ? <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{files.map((file) => <label key={file.id} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card p-2.5"><input type="checkbox" checked={draft.resourceIds.includes(file.id)} onChange={() => toggleResource(file.id)} className="size-4 accent-primary" /><FileText className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-sm" title={file.name}>{file.name}</span></label>)}</div> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Ainda não há ficheiros. Carregue-os no separador Os meus ficheiros.</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-xs text-muted-foreground">Os planos são guardados na escola ativa e visíveis apenas para si.</span><Button type="submit" disabled={savingLesson || loading}>{savingLesson ? <LoaderCircle className="animate-spin" /> : <Save />} {savingLesson ? "A guardar…" : editingId ? "Guardar alterações" : "Guardar plano de aula"}</Button></div>
          </form></CardContent>
        </Card>

        <Card className="shadow-sm"><CardHeader><CardTitle>Planos guardados</CardTitle><CardDescription>Selecione um plano aqui ou no separador As minhas apresentações.</CardDescription></CardHeader><CardContent className="grid gap-3">
          {loading ? <p className="py-4 text-sm text-muted-foreground">A carregar planos…</p> : lessonPlans.length ? lessonPlans.map((lesson) => <article key={lesson.id} className={`grid gap-3 rounded-xl border p-3 ${selectedLessonId === lesson.id ? "border-primary/50 bg-primary/5" : "bg-card"}`}>
            <button type="button" className="grid min-w-0 gap-1 text-left" onClick={() => { setSelectedLessonId(lesson.id); toast.success("Plano selecionado para a próxima apresentação."); }}><span className="truncate font-semibold">{lesson.title}</span><span className="text-xs text-muted-foreground">{lesson.lessonNumber ? `Aula ${lesson.lessonNumber} · ` : ""}{lesson.subject} · {lesson.level}</span><span className="text-xs text-muted-foreground">{lesson.files.length} ficheiro(s) · {lesson.resourceUrls.length} URL(s)</span></button>
            <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant={selectedLessonId === lesson.id ? "secondary" : "outline"}>{selectedLessonId === lesson.id ? "Selecionado" : "Plano de aula"}</Badge><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editLesson(lesson)}>Editar</Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Eliminar plano ${lesson.title}`} onClick={() => void deleteLesson(lesson)}><Trash2 className="size-4" /></Button></div></div>
          </article>) : <div className="grid min-h-40 place-content-center justify-items-center gap-2 rounded-xl border border-dashed p-5 text-center"><BookOpen className="size-6 text-muted-foreground" /><p className="text-sm font-medium">Ainda não há planos guardados.</p><p className="text-xs text-muted-foreground">Crie o primeiro plano de aula no formulário.</p></div>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="ficheiros" className="min-w-0">
        <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-primary" /> Os meus ficheiros</CardTitle><CardDescription>Carregue materiais para os associar aos seus planos de aula.</CardDescription></CardHeader><CardContent className="grid gap-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 p-7 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><FileImage className="size-5" /></span><div><p className="font-medium">Adicionar recursos à biblioteca</p><p className="mt-1 text-sm text-muted-foreground">PDF, imagens, texto ou documentos Office. Máximo 20 MB por ficheiro.</p></div><input id="presentation-resource-upload" type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx,.pptx,.xlsx" disabled={uploadingFile} onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" disabled={uploadingFile} render={<label htmlFor="presentation-resource-upload" className="cursor-pointer" />}>{uploadingFile ? <LoaderCircle className="animate-spin" /> : <Upload />} {uploadingFile ? "A carregar…" : "Escolher ficheiro"}</Button><p className="max-w-2xl text-xs text-muted-foreground">Os ficheiros são armazenados por URL público não listado: qualquer pessoa que tenha o endereço direto poderá abri-los. Evite carregar dados pessoais sensíveis.</p></div>
          {loading ? <p className="text-sm text-muted-foreground">A carregar ficheiros…</p> : files.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{files.map((file) => <article key={file.id} className="flex min-w-0 items-start gap-3 rounded-xl border bg-card p-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><a href={file.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium underline-offset-4 hover:underline" title={file.name}>{file.name}</a><p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)}</p><p className="mt-1 text-xs text-muted-foreground">{lessonPlans.some((lesson) => lesson.files.some((item) => item.id === file.id)) ? "Associado a um plano" : "Disponível para associar"}</p></div><Button type="button" size="icon-sm" variant="ghost" aria-label={`Eliminar ficheiro ${file.name}`} disabled={deletingFileId === file.id} onClick={() => void deleteFile(file)}>{deletingFileId === file.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</Button></article>)}</div> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">A biblioteca está vazia. Carregue um recurso para o usar nos seus planos de aula.</p>}
          {files.length > 0 && <Button type="button" variant="outline" className="w-fit" onClick={() => setActiveTab("planos")}><BookOpen /> Associar a um plano de aula</Button>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="apresentacoes" className="grid min-w-0 gap-5">
        <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-5 text-primary" /> As minhas apresentações</CardTitle><CardDescription>Selecione um plano guardado. Os seus objetivos, detalhes e recursos serão usados para criar a apresentação.</CardDescription></CardHeader><CardContent className="grid gap-4">
          <label className="grid gap-2"><span className={labelClass}>Plano de aulas *</span><select className={inputClass} value={selectedLessonId} onChange={(event) => { setSelectedLessonId(event.target.value); setPresentation(null); setShowPresentationOptions(false); }}><option value="">Selecione um plano de aula guardado…</option>{lessonPlans.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.lessonNumber ? `Aula ${lesson.lessonNumber} · ` : ""}${lesson.title} — ${lesson.subject}</option>)}</select></label>
          {selectedLesson && <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Aula selecionada</p><p className="mt-1 font-semibold">{selectedLesson.title}</p><p className="text-sm text-muted-foreground">{selectedLesson.lessonNumber ? `N.º ${selectedLesson.lessonNumber} · ` : ""}{selectedLesson.subject} · {selectedLesson.level}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Materiais</p><p className="mt-1 text-sm text-muted-foreground">{selectedLesson.files.length} ficheiro(s) · {selectedLesson.resourceUrls.length} URL(s)</p></div><p className="text-sm sm:col-span-2">{selectedLesson.objectives || "Sem objetivos específicos registados."}</p><Button type="button" variant="link" className="w-fit justify-self-start p-0" onClick={() => editLesson(selectedLesson)}>Editar plano de aula</Button></div>}
          {!showPresentationOptions && <Button type="button" className="w-fit" disabled={!selectedLesson || loading} onClick={() => { setPresentation(null); setShowPresentationOptions(true); }}><Plus /> Criar apresentação</Button>}
        </CardContent></Card>

        {showPresentationOptions && selectedLesson && <>
          <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Presentation className="size-5 text-primary" /> Escolher modelo</CardTitle><CardDescription>O modelo define o estilo e a abordagem visual da apresentação para a aula selecionada.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{PRESENTATION_TEMPLATES.map((item) => { const Icon = templateIcons[item.id]; const active = templateId === item.id; return <button key={item.id} type="button" aria-pressed={active} onClick={() => chooseTemplate(item.id)} className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-card"}`}><span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: item.colors.cover, color: item.colors.accent }}><Icon className="size-5" /></span><span className="grid min-w-0 gap-1"><span className="flex items-center gap-2 text-sm font-semibold">{item.name}{active && <span className="text-[10px] font-medium text-primary">ATIVO</span>}</span><span className="text-xs leading-relaxed text-muted-foreground">{item.subject} · {item.description}</span></span></button>; })}</CardContent></Card>
          <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Palette className="size-5 text-primary" /> Personalizar design</CardTitle><CardDescription>Ajuste as cores do modelo, adicione uma imagem de capa e defina o número de diapositivos.</CardDescription></CardHeader><CardContent className="grid gap-5"><div className="flex flex-wrap gap-2">{palettes.map((palette) => <Button key={palette.name} type="button" size="sm" variant="outline" className={design.accentColor === palette.accentColor ? "border-primary ring-1 ring-primary/30" : ""} onClick={() => setDesign((current) => ({ ...current, ...palette }))}>{palette.name}</Button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{([["Fundo da capa", "coverBackgroundColor"], ["Texto da capa", "coverTextColor"], ["Fundo dos diapositivos", "backgroundColor"], ["Títulos", "headingColor"], ["Texto", "textColor"], ["Destaques", "accentColor"]] as const).map(([label, key]) => <label key={key} className="grid gap-1.5 text-xs font-medium text-muted-foreground">{label}<input type="color" aria-label={label} className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background p-1" value={design[key]} onChange={(event) => setDesign((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))} /></label>)}</div><div className="flex flex-wrap items-center gap-3 border-t pt-4"><input id="presentation-cover-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addCoverImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button type="button" variant="outline" render={<label htmlFor="presentation-cover-image" className="cursor-pointer" />}><ImagePlus /> Imagem de capa</Button>{design.coverImageData && <><div role="img" aria-label="Imagem da capa" className="size-10 rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url("${design.coverImageData}")` }} /><Button type="button" size="icon-sm" variant="ghost" aria-label="Remover imagem da capa" onClick={() => setDesign((current) => ({ ...current, coverImageData: undefined }))}><X /></Button></>}</div><label className="grid max-w-xs gap-2"><span className={labelClass}>Número de diapositivos</span><select className={inputClass} value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))}>{[4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => <option key={count} value={count}>{count} diapositivos</option>)}</select></label><div className="flex flex-wrap gap-3 border-t pt-4"><Button type="button" onClick={() => void createPresentation()} disabled={generating}>{generating ? <LoaderCircle className="animate-spin" /> : <Play />}{generating ? "A criar apresentação…" : presentation ? "Gerar novamente" : "Gerar diapositivos"}</Button><Button type="button" variant="outline" onClick={() => setShowPresentationOptions(false)}>Cancelar</Button></div></CardContent></Card>
        </>}

        {presentation && selectedLesson && <Card className="shadow-sm"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Badge variant="secondary" className="mb-2">{presentation.slides.length + 1} diapositivos · {template.name}</Badge><CardTitle>{presentation.title}</CardTitle><CardDescription>A partir do plano “{selectedLesson.title}”. Reveja o conteúdo antes de apresentar.</CardDescription></div><Button type="button" onClick={() => setIsPresenting(true)}><Play /> Apresentar</Button></CardHeader><CardContent className="grid gap-4">{presentation.slides.map((slide, index) => <article key={index} className="grid gap-3 rounded-xl border bg-muted/20 p-4"><Badge variant="outline" className="w-fit">Diapositivo {index + 2}</Badge><label className="grid gap-2"><span className={labelClass}>Título</span><input className={inputClass} maxLength={100} value={slide.title} onChange={(event) => updateSlide(index, { title: event.target.value })} /></label><label className="grid gap-2"><span className={labelClass}>Pontos</span><Textarea rows={5} value={slide.bullets.join("\n")} onChange={(event) => updateSlide(index, { bullets: event.target.value.split(/\r?\n/).slice(0, 6) })} /></label><div className="flex flex-wrap items-center gap-3"><input id={`presentation-slide-image-${index}`} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addSlideImage(index, event.target.files?.[0]); event.currentTarget.value = ""; }} /><Button type="button" size="sm" variant="outline" render={<label htmlFor={`presentation-slide-image-${index}`} className="cursor-pointer" />}><ImagePlus /> Imagem do diapositivo</Button>{slide.imageData && <><div role="img" aria-label={`Imagem do diapositivo ${index + 2}`} className="size-10 rounded-lg border bg-cover bg-center" style={{ backgroundImage: `url("${slide.imageData}")` }} /><Button type="button" size="icon-sm" variant="ghost" aria-label="Remover imagem" onClick={() => updateSlide(index, { imageData: undefined })}><X /></Button></>}</div><label className="grid gap-2"><span className={labelClass}>Notas do apresentador</span><Textarea rows={2} maxLength={800} value={slide.speakerNotes ?? ""} onChange={(event) => updateSlide(index, { speakerNotes: event.target.value })} /></label></article>)}{linkedResources.length > 0 && <div className="grid gap-2 rounded-xl border p-4"><p className="font-semibold">Recursos do plano selecionado</p>{linkedResources.map((resource, index) => <a key={`${resource.url}-${index}`} href={resource.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary underline-offset-4 hover:underline">{resource.name}</a>)}</div>}</CardContent></Card>}
      </TabsContent>
    </Tabs>
    {isPresenting && presentation && <PresentationPlayer plan={presentation} template={template} design={design} resources={linkedResources} onClose={() => setIsPresenting(false)} />}
  </div>;
}
