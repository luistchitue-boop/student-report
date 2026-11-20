import PptxGenJS from "pptxgenjs";

export type PresentationSlide = { title: string; bullets: string[]; speakerNotes?: string; imageData?: string };
export type PresentationPlan = { title: string; slides: PresentationSlide[] };
export type PresentationDesign = {
  coverBackgroundColor: string;
  coverTextColor: string;
  backgroundColor: string;
  headingColor: string;
  textColor: string;
  accentColor: string;
  coverImageData?: string;
};

const DEFAULT_DESIGN: PresentationDesign = {
  coverBackgroundColor: "173044",
  coverTextColor: "FFFFFF",
  backgroundColor: "F8FAFC",
  headingColor: "173044",
  textColor: "263746",
  accentColor: "39755D",
};
const MAX_IMAGE_DATA_LENGTH = 850_000;
const MAX_TOTAL_IMAGE_DATA_LENGTH = 8_000_000;

export function validatePresentationImageData(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > MAX_IMAGE_DATA_LENGTH) throw new Error("Cada imagem deve ter menos de 850 KB após a otimização.");
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error("Formato de imagem inválido. Carregue uma imagem JPEG, PNG ou WebP.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("Não foi possível validar uma das imagens carregadas.");
  return value;
}

export function validatePresentationDesign(value: unknown): PresentationDesign {
  if (!value || typeof value !== "object") return { ...DEFAULT_DESIGN };
  const candidate = value as Record<string, unknown>;
  const color = (key: keyof Omit<PresentationDesign, "coverImageData">) => {
    const candidateColor = candidate[key];
    if (candidateColor === undefined) return DEFAULT_DESIGN[key];
    if (typeof candidateColor !== "string" || !/^#[0-9a-f]{6}$/i.test(candidateColor)) throw new Error("Uma das cores escolhidas é inválida.");
    return candidateColor.slice(1).toUpperCase();
  };
  return {
    coverBackgroundColor: color("coverBackgroundColor"),
    coverTextColor: color("coverTextColor"),
    backgroundColor: color("backgroundColor"),
    headingColor: color("headingColor"),
    textColor: color("textColor"),
    accentColor: color("accentColor"),
    coverImageData: validatePresentationImageData(candidate.coverImageData),
  };
}

export function validatePresentationPlan(value: unknown): PresentationPlan {
  if (!value || typeof value !== "object") throw new Error("Plano de apresentação inválido.");
  const candidate = value as { title?: unknown; slides?: unknown };
  if (typeof candidate.title !== "string" || !Array.isArray(candidate.slides)) throw new Error("Plano de apresentação inválido.");
  if (candidate.title.length > 120 || candidate.slides.length < 2 || candidate.slides.length > 11) throw new Error("Número de diapositivos ou título inválido.");
  let totalImageDataLength = 0;
  const slides = candidate.slides.map((item): PresentationSlide => {
    if (!item || typeof item !== "object") throw new Error("Diapositivo inválido.");
    const slide = item as { title?: unknown; bullets?: unknown; speakerNotes?: unknown; imageData?: unknown };
    if (typeof slide.title !== "string" || slide.title.length > 100 || !Array.isArray(slide.bullets) || slide.bullets.length > 6) throw new Error("Diapositivo inválido.");
    const bullets = slide.bullets.map((bullet) => {
      if (typeof bullet !== "string" || bullet.length > 240) throw new Error("Texto de diapositivo inválido.");
      return bullet;
    });
    if (slide.speakerNotes !== undefined && (typeof slide.speakerNotes !== "string" || slide.speakerNotes.length > 800)) throw new Error("Notas de diapositivo inválidas.");
    const imageData = validatePresentationImageData(slide.imageData);
    totalImageDataLength += imageData?.length ?? 0;
    return { title: slide.title, bullets, ...(typeof slide.speakerNotes === "string" ? { speakerNotes: slide.speakerNotes } : {}), ...(imageData ? { imageData } : {}) };
  });
  if (totalImageDataLength > MAX_TOTAL_IMAGE_DATA_LENGTH) throw new Error("O conjunto de imagens excede o tamanho total permitido.");
  return { title: candidate.title, slides };
}

export async function createPresentationFile(plan: PresentationPlan, metadata: { subject: string; level: string; author: string; school: string }, design: PresentationDesign) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = metadata.author;
  pptx.subject = metadata.subject;
  pptx.title = plan.title;
  pptx.company = metadata.school;
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: design.coverBackgroundColor };
  const coverHasImage = Boolean(design.coverImageData);
  titleSlide.addShape(pptx.ShapeType.rect, { x: 0.65, y: 1.05, w: 0.12, h: 4.2, line: { color: design.accentColor, transparency: 100 }, fill: { color: design.accentColor } });
  titleSlide.addText(plan.title, { x: 1.05, y: 1.35, w: coverHasImage ? 6.2 : 11.1, h: 2.2, fontFace: "Aptos Display", fontSize: 34, bold: true, color: design.coverTextColor, valign: "middle", fit: "shrink" });
  titleSlide.addText(`${metadata.subject}  ·  ${metadata.level}`, { x: 1.08, y: 3.8, w: coverHasImage ? 6.1 : 10.8, h: 0.6, fontFace: "Aptos", fontSize: 19, color: design.accentColor, fit: "shrink" });
  titleSlide.addText("Material de apoio pedagógico", { x: 1.08, y: 6.55, w: 8.5, h: 0.32, fontFace: "Aptos", fontSize: 11, color: design.coverTextColor, transparency: 25 });
  if (design.coverImageData) titleSlide.addImage({ data: design.coverImageData, x: 7.6, y: 1.05, w: 5.05, h: 5.65, sizing: { type: "cover", w: 5.05, h: 5.65 }, rounding: true, altText: "Imagem de capa da apresentação" });

  plan.slides.forEach((content, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: design.backgroundColor };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: design.accentColor, transparency: 100 }, fill: { color: design.accentColor } });
    slide.addShape(pptx.ShapeType.rect, { x: 0.72, y: 0.62, w: 0.08, h: 0.66, line: { color: design.accentColor, transparency: 100 }, fill: { color: design.accentColor } });
    slide.addText(content.title, { x: 0.98, y: 0.58, w: 11.6, h: 0.78, fontFace: "Aptos Display", fontSize: 25, bold: true, color: design.headingColor, fit: "shrink" });
    const hasImage = Boolean(content.imageData);
    if (content.bullets.length) {
      slide.addText(content.bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 4, breakLine: true, paraSpaceAfterPt: 15 } })), {
        x: 0.95, y: 1.72, w: hasImage ? 7.0 : 11.45, h: 4.75, fontFace: "Aptos", fontSize: 19, color: design.textColor, valign: "top", fit: "shrink", margin: 0.08,
      });
    }
    if (content.imageData) slide.addImage({ data: content.imageData, x: 8.45, y: 1.72, w: 4.05, h: 4.65, sizing: { type: "cover", w: 4.05, h: 4.65 }, rounding: true, altText: `Imagem do diapositivo: ${content.title}` });
    slide.addText(`${metadata.subject} · ${metadata.level}`, { x: 0.75, y: 7.08, w: 10.5, h: 0.2, fontFace: "Aptos", fontSize: 9, color: design.textColor, transparency: 25 });
    slide.addText(String(index + 2), { x: 12.1, y: 7.03, w: 0.45, h: 0.28, fontFace: "Aptos", fontSize: 10, color: design.accentColor, bold: true, align: "right" });
    if (content.speakerNotes) slide.addNotes(content.speakerNotes);
  });

  return await pptx.write({ outputType: "nodebuffer", compression: true }) as Buffer;
}

export function safePresentationFilename(title: string) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${slug || "apresentacao"}.pptx`;
}
