const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

type MonthlyFacts = {
  month: string;
  gradeCount: number;
  negativeGrades: number;
  absenceCount: number;
  unjustifiedAbsences: number;
};

type Comparison = { current: MonthlyFacts; previous: MonthlyFacts; gradeScale: number };
type Completion = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> };

export async function generateMonthlyComment(comparison: Comparison) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI gateway is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: "Escreva em português usado em Angola uma observação escolar objetiva e respeitosa, com no máximo 300 caracteres, comparando o mês selecionado com o anterior. Use apenas os números fornecidos, sem inventar nomes, causas, comportamento ou tendências. Os totais referem-se a registos, não a dias; faltas incluem ausência na sala e falta de material. Notas negativas são inferiores a metade da escala; apenas notas semanais são consideradas. Ausência de notas não significa bom desempenho. O mês atual pode estar incompleto, pelo que menos registos não provam melhoria. Não use Markdown nem aspas. Responda apenas com a observação.",
          },
          { role: "user", content: JSON.stringify(comparison) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI gateway returned ${response.status}.`);
    const completion = await response.json() as Completion;
    const content = completion.choices?.[0]?.message?.content;
    const text = (typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : "").trim();
    if (!text || text.length > 300) throw new Error("Generated comment is empty or exceeds 300 characters.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
