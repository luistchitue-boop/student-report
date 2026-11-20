import PptxGenJS from "pptxgenjs";

export type PresentationSlide = { title: string; bullets: string[]; speakerNotes?: string };
export type PresentationPlan = { title: string; slides: PresentationSlide[] };

export function validatePresentationPlan(value: unknown): PresentationPlan {
  if (!value || typeof value !== "object") throw new Error("Plano de apresentação inválido.");
  const candidate = value as { title?: unknown; slides?: unknown };
  if (typeof candidate.title !== "string" || !Array.isArray(candidate.slides)) throw new Error("Plano de apresentação inválido.");
  if (candidate.title.length > 120 || candidate.slides.length < 2 || candidate.slides.length > 11) throw new Error("Número de diapositivos ou título inválido.");
  const slides = candidate.slides.map((item): PresentationSlide => {
    if (!item || typeof item !== "object") throw new Error("Diapositivo inválido.");
    const slide = item as { title?: unknown; bullets?: unknown; speakerNotes?: unknown };
    if (typeof slide.title !== "string" || slide.title.length > 100 || !Array.isArray(slide.bullets) || slide.bullets.length > 6) throw new Error("Diapositivo inválido.");
    const bullets = slide.bullets.map((bullet) => {
      if (typeof bullet !== "string" || bullet.length > 240) throw new Error("Texto de diapositivo inválido.");
      return bullet;
    });
    if (slide.speakerNotes !== undefined && (typeof slide.speakerNotes !== "string" || slide.speakerNotes.length > 800)) throw new Error("Notas de diapositivo inválidas.");
    return { title: slide.title, bullets, ...(typeof slide.speakerNotes === "string" ? { speakerNotes: slide.speakerNotes } : {}) };
  });
  return { title: candidate.title, slides };
}

export async function createPresentationFile(plan: PresentationPlan, metadata: { subject: string; level: string; author: string; school: string }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = metadata.author;
  pptx.subject = metadata.subject;
  pptx.title = plan.title;
  pptx.company = metadata.school;
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "173044" };
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0.65, y: 1.05, w: 0.12, h: 4.2, line: { color: "BEE26E", transparency: 100 }, fill: { color: "BEE26E" } });
  titleSlide.addText(plan.title, { x: 1.05, y: 1.35, w: 11.1, h: 2.2, fontFace: "Aptos Display", fontSize: 34, bold: true, color: "FFFFFF", valign: "middle", fit: "shrink" });
  titleSlide.addText(`${metadata.subject}  ·  ${metadata.level}`, { x: 1.08, y: 3.8, w: 10.8, h: 0.6, fontFace: "Aptos", fontSize: 19, color: "BEE26E", fit: "shrink" });
  titleSlide.addText("Material de apoio pedagógico", { x: 1.08, y: 6.55, w: 8.5, h: 0.32, fontFace: "Aptos", fontSize: 11, color: "CBD5E1" });

  plan.slides.forEach((content, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F8FAFC" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: "39755D", transparency: 100 }, fill: { color: "39755D" } });
    slide.addText(content.title, { x: 0.72, y: 0.58, w: 11.9, h: 0.78, fontFace: "Aptos Display", fontSize: 25, bold: true, color: "173044", fit: "shrink" });
    if (content.bullets.length) {
      slide.addText(content.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true, paraSpaceAfterPt: 15 } })), {
        x: 0.95, y: 1.72, w: 11.45, h: 4.75, fontFace: "Aptos", fontSize: 19, color: "263746", valign: "top", fit: "shrink", margin: 0.08,
      });
    }
    slide.addText(`${metadata.subject} · ${metadata.level}`, { x: 0.75, y: 7.08, w: 10.5, h: 0.2, fontFace: "Aptos", fontSize: 9, color: "64748B" });
    slide.addText(String(index + 2), { x: 12.1, y: 7.03, w: 0.45, h: 0.28, fontFace: "Aptos", fontSize: 10, color: "64748B", align: "right" });
    if (content.speakerNotes) slide.addNotes(content.speakerNotes);
  });

  return await pptx.write({ outputType: "nodebuffer", compression: true }) as Buffer;
}

export function safePresentationFilename(title: string) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${slug || "apresentacao"}.pptx`;
}
