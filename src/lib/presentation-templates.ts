export type TemplateId = "history" | "mathematics" | "english" | "geography" | "science" | "portuguese" | "arts" | "general";
export type TemplateLayout = "timeline" | "formula" | "editorial" | "atlas" | "lab" | "literature" | "gallery" | "story";
export type PresentationTemplate = {
  id: TemplateId;
  name: string;
  subject: string;
  description: string;
  layout: TemplateLayout;
  colors: { cover: string; accent: string; surface: string; ink: string };
};

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  { id: "history", name: "Linha do tempo", subject: "História", description: "Marcos, datas e acontecimentos ligados por uma linha narrativa.", layout: "timeline", colors: { cover: "#34251E", accent: "#D79A52", surface: "#F8F0E3", ink: "#382E25" } },
  { id: "mathematics", name: "Quadro de Matemática", subject: "Matemática", description: "Um quadro de giz com fórmulas, diagramas e páginas inspiradas no modelo enviado.", layout: "formula", colors: { cover: "#252321", accent: "#FFFFFF", surface: "#302E2B", ink: "#FFFFFF" } },
  { id: "english", name: "English Studio", subject: "Inglês", description: "Vocabulário, expressões e prática de conversação em cartões.", layout: "editorial", colors: { cover: "#282448", accent: "#FF8D70", surface: "#F6F2FA", ink: "#292344" } },
  { id: "geography", name: "Atlas", subject: "Geografia", description: "Regiões, lugares e paisagens com foco visual e espacial.", layout: "atlas", colors: { cover: "#13352F", accent: "#72C69B", surface: "#EFF7F0", ink: "#18362D" } },
  { id: "science", name: "Caderno de Ciências", subject: "Ciências", description: "Conceitos, observações e experiências organizados por etapas.", layout: "lab", colors: { cover: "#102F38", accent: "#70D8D1", surface: "#EFF8F8", ink: "#17343B" } },
  { id: "portuguese", name: "Círculo de Leitura", subject: "Língua Portuguesa", description: "Leitura, interpretação e recursos de escrita com foco em citações.", layout: "literature", colors: { cover: "#432735", accent: "#E7A8BD", surface: "#FBF1F4", ink: "#422A37" } },
  { id: "arts", name: "Ateliê Criativo", subject: "Artes", description: "Composição visual expressiva para explorar formas e ideias.", layout: "gallery", colors: { cover: "#383028", accent: "#F3B94F", surface: "#F8F3E9", ink: "#352D27" } },
  { id: "general", name: "Aula Essencial", subject: "Multidisciplinar", description: "Um modelo versátil e claro para qualquer tema ou disciplina.", layout: "story", colors: { cover: "#173044", accent: "#8BD1B2", surface: "#F4F7F8", ink: "#263746" } },
];

export function getPresentationTemplate(id: string) {
  return PRESENTATION_TEMPLATES.find((template) => template.id === id) ?? PRESENTATION_TEMPLATES[PRESENTATION_TEMPLATES.length - 1];
}
