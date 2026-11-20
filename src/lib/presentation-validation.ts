export type PresentationSlide = { title: string; bullets: string[]; speakerNotes?: string; imageData?: string };
export type PresentationPlan = { title: string; slides: PresentationSlide[] };

const MAX_IMAGE_DATA_LENGTH = 850_000;

export function validatePresentationImageData(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > MAX_IMAGE_DATA_LENGTH) throw new Error("Cada imagem deve ter menos de 850 KB após a otimização.");
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new Error("Formato de imagem inválido. Carregue uma imagem JPEG, PNG ou WebP.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("Não foi possível validar uma das imagens carregadas.");
  return value;
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
  if (totalImageDataLength > 8_000_000) throw new Error("O conjunto de imagens excede o tamanho total permitido.");
  return { title: candidate.title, slides };
}
