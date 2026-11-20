"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { BookOpen, Calculator, ChevronLeft, ChevronRight, FlaskConical, Globe2, History, Languages, Maximize, Minimize, Palette, Presentation, Quote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresentationPlan, PresentationSlide } from "@/lib/presentation-validation";
import type { PresentationTemplate } from "@/lib/presentation-templates";

type Design = { coverBackgroundColor: string; coverTextColor: string; backgroundColor: string; headingColor: string; textColor: string; accentColor: string; coverImageData?: string };

const icons = { history: History, mathematics: Calculator, english: Languages, geography: Globe2, science: FlaskConical, portuguese: BookOpen, arts: Palette, general: Presentation };

export function PresentationPlayer({ plan, template, design, onClose }: { plan: PresentationPlan; template: PresentationTemplate; design: Design; onClose: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const Icon = icons[template.id];
  const totalSlides = plan.slides.length + 1;
  const isCover = slideIndex === 0;
  const slide: PresentationSlide | undefined = isCover ? undefined : plan.slides[slideIndex - 1];

  useEffect(() => {
    const content = contentRef.current;
    if (!stageRef.current || !content) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const distance = template.layout === "timeline" ? -42 : 30;
    if (motionPreference.matches) {
      gsap.set(content, { opacity: 1, x: 0, y: 0, scale: 1 });
      return;
    }
    gsap.fromTo(content, { opacity: 0, x: isCover ? 0 : distance, y: isCover ? 16 : 0, scale: isCover ? 0.985 : 1 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.68, ease: "power3.out", clearProps: "all" });
    return () => { gsap.killTweensOf(content); };
  }, [slideIndex, template.layout, isCover]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        setSlideIndex((index) => Math.min(totalSlides - 1, index + 1));
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setSlideIndex((index) => Math.max(0, index - 1));
      } else if (event.key === "Escape" && !document.fullscreenElement) {
        onClose();
      }
    }
    function onFullscreenChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [onClose, totalSlides]);

  function move(direction: -1 | 1) {
    setSlideIndex((index) => Math.max(0, Math.min(totalSlides - 1, index + direction)));
  }

  async function toggleFullscreen() {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current.requestFullscreen();
    } catch {
      // Fullscreen is optional; the presentation still works in the page.
    }
  }

  function renderCover() {
    return <div className="relative flex h-full w-full items-center overflow-hidden p-8 sm:p-14 lg:p-20" style={{ backgroundColor: design.coverBackgroundColor, color: design.coverTextColor }}>
      <div className="absolute -right-20 -top-32 size-[min(70vw,46rem)] rounded-full border opacity-20" style={{ borderColor: design.accentColor, borderWidth: 1 }} />
      <div className="absolute -right-5 -top-16 size-[min(58vw,37rem)] rounded-full border opacity-15" style={{ borderColor: design.accentColor, borderWidth: 1 }} />
      <div className="absolute bottom-8 right-10 h-24 w-1/3 opacity-30" style={{ backgroundImage: `radial-gradient(${design.accentColor} 1px, transparent 1px)`, backgroundSize: "14px 14px" }} />
      {design.coverImageData && <div className="absolute inset-y-0 right-0 hidden w-[43%] bg-cover bg-center opacity-75 md:block" style={{ backgroundImage: `linear-gradient(90deg, ${design.coverBackgroundColor}, transparent 45%), url("${design.coverImageData}")` }} />}
      <div className="relative z-10 grid max-w-3xl gap-5" ref={contentRef}>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: design.accentColor }}><span className="flex size-10 items-center justify-center rounded-full border" style={{ borderColor: `${design.accentColor}80` }}><Icon className="size-5" /></span>{template.subject} · {template.name}</div>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">{plan.title}</h1>
        <p className="text-base opacity-80 sm:text-xl">{template.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="rounded-full px-4 py-2 font-semibold" style={{ backgroundColor: design.accentColor, color: design.coverBackgroundColor }}>{plan.slides.length} tópicos</span><span className="opacity-70">Material de aula · Use as setas para navegar</span></div>
      </div>
      <div className="absolute bottom-8 left-8 flex items-center gap-2 text-xs opacity-70 sm:left-14 lg:left-20"><span className="size-2 rounded-full" style={{ backgroundColor: design.accentColor }} /> {template.subject} · Apresentação pedagógica</div>
    </div>;
  }

  function renderDecorativeSlide() {
    if (!slide) return null;
    const isDark = template.layout === "formula" || template.layout === "lab";
    return <div className="relative h-full w-full overflow-hidden p-7 sm:p-12 lg:p-16" style={{ backgroundColor: isDark ? design.coverBackgroundColor : design.backgroundColor, color: isDark ? design.coverTextColor : design.textColor }}>
      {template.layout === "atlas" && <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(ellipse at 70% 50%, transparent 0 24%, ${design.accentColor} 24.2% 24.5%, transparent 24.7% 36%, ${design.accentColor} 36.2% 36.5%, transparent 36.7%), radial-gradient(${design.accentColor} 1px, transparent 1px)`, backgroundSize: "100% 100%, 22px 22px" }} />}
      {template.layout === "formula" && <div className="absolute right-8 top-8 rotate-6 rounded-2xl border px-5 py-3 text-5xl font-black opacity-10 sm:right-16 sm:top-12 sm:text-8xl" style={{ borderColor: design.accentColor, color: design.accentColor }}>∑</div>}
      {template.layout === "lab" && <div className="absolute -right-16 -top-20 size-72 rounded-full border opacity-15" style={{ borderColor: design.accentColor, boxShadow: `0 0 0 26px ${design.accentColor}10, 0 0 0 52px ${design.accentColor}08` }} />}
      {template.layout === "gallery" && <div className="absolute right-8 top-10 flex -rotate-6 gap-2 opacity-70"><span className="size-12 rounded-full" style={{ backgroundColor: design.accentColor }} /><span className="mt-8 size-8 rotate-12" style={{ backgroundColor: design.accentColor }} /></div>}
      <div className="relative z-10 flex h-full flex-col">
        <div ref={contentRef} className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em]" style={{ color: design.accentColor }}><Icon className="size-5" />{template.subject}</div>
            <span className="text-xs font-semibold opacity-60">{String(slideIndex).padStart(2, "0")} / {String(totalSlides - 1).padStart(2, "0")}</span>
          </div>
          <div className="mt-7 flex flex-1 flex-col justify-center sm:mt-10">
            <div className={`grid flex-1 gap-6 ${slide.imageData ? "md:grid-cols-[1.1fr_.9fr]" : ""}`}>
              <div className="flex flex-col justify-center">
                {template.layout === "literature" && <Quote className="mb-4 size-8" style={{ color: design.accentColor }} />}
                <span className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] opacity-60">{template.layout === "timeline" ? "Contexto e acontecimentos" : template.layout === "formula" ? "Conceito em foco" : template.layout === "atlas" ? "Explorar o lugar" : template.layout === "lab" ? "Observação" : template.layout === "editorial" ? "English studio" : template.layout === "literature" ? "Leitura e interpretação" : template.layout === "gallery" ? "Ideia em composição" : "Ponto de aprendizagem"}</span>
                <h2 className="max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl" style={{ color: isDark ? design.coverTextColor : design.headingColor }}>{slide.title}</h2>
                <div className="mt-7 grid gap-3 sm:mt-9 sm:grid-cols-2">
                  {slide.bullets.map((bullet, index) => <div key={`${index}-${bullet}`} className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-relaxed sm:p-4 sm:text-base" style={{ borderColor: `${design.accentColor}45`, backgroundColor: isDark ? `${design.coverTextColor}08` : `${design.accentColor}0B` }}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ backgroundColor: design.accentColor, color: isDark ? design.coverBackgroundColor : design.backgroundColor }}>{template.layout === "timeline" ? "•" : template.layout === "formula" ? String(index + 1).padStart(2, "0") : template.layout === "editorial" ? "Aa" : String(index + 1)}</span>
                    <span>{bullet}</span>
                  </div>)}
                </div>
              </div>
              {slide.imageData && <div className="relative min-h-36 overflow-hidden rounded-2xl border" style={{ borderColor: `${design.accentColor}65` }}><Image src={slide.imageData} alt={`Ilustração: ${slide.title}`} fill unoptimized sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" /></div>}
            </div>
          </div>
          {slide.speakerNotes && <p className="mt-4 max-w-4xl border-l-2 pl-3 text-sm italic opacity-70" style={{ borderColor: design.accentColor }}>{slide.speakerNotes}</p>}
          {template.layout === "timeline" && <div className="absolute bottom-6 left-0 right-0 h-0.5 opacity-50" style={{ backgroundColor: design.accentColor }}><span className="absolute -top-1.5 size-3 rounded-full" style={{ left: `${(slideIndex / totalSlides) * 100}%`, backgroundColor: design.accentColor }} /></div>}
        </div>
      </div>
    </div>;
  }

  return <div ref={stageRef} className="fixed inset-0 z-[100] flex flex-col bg-[#101820] p-3 text-white sm:p-5" aria-label="Modo de apresentação">
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-1 sm:px-2">
      <div className="flex min-w-0 items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: design.accentColor, color: design.coverBackgroundColor }}><Icon className="size-4" /></span><span className="truncate text-sm font-semibold">{template.name}</span><span className="hidden text-xs text-white/50 sm:inline">· {plan.title}</span></div>
      <div className="flex items-center gap-1"><span className="mr-2 text-xs tabular-nums text-white/60">{slideIndex + 1} / {totalSlides}</span><Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" onClick={toggleFullscreen} aria-label={isFullscreen ? "Sair do ecrã inteiro" : "Ecrã inteiro"}>{isFullscreen ? <Minimize /> : <Maximize />}</Button><Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Fechar apresentação"><X /></Button></div>
    </header>
    <div className="relative mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 items-center justify-center py-2">
      <div className="relative aspect-[16/9] max-h-full w-full overflow-hidden rounded-xl shadow-2xl sm:rounded-2xl" style={{ maxWidth: "calc((100svh - 8rem) * 16 / 9)" }}>
        {isCover ? renderCover() : renderDecorativeSlide()}
      </div>
    </div>
    <footer className="flex h-14 shrink-0 items-center justify-center gap-3">
      <Button variant="outline" size="icon" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => move(-1)} disabled={slideIndex === 0} aria-label="Diapositivo anterior"><ChevronLeft /></Button>
      <div className="flex max-w-[50vw] gap-1.5 overflow-hidden px-2" aria-label="Progresso da apresentação">{Array.from({ length: totalSlides }, (_, index) => <button key={index} type="button" className="h-1.5 min-w-4 rounded-full transition-all" style={{ width: index === slideIndex ? 28 : 16, backgroundColor: index === slideIndex ? design.accentColor : "#ffffff40" }} onClick={() => setSlideIndex(index)} aria-label={`Ir para o diapositivo ${index + 1}`} />)}</div>
      <Button variant="outline" size="icon" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => move(1)} disabled={slideIndex === totalSlides - 1} aria-label="Próximo diapositivo"><ChevronRight /></Button>
    </footer>
  </div>;
}
