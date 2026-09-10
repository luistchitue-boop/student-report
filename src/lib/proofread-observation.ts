const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_AI_GATEWAY_MODEL = "google/gemini-2.5-flash-lite";
const REQUEST_TIMEOUT_MS = 8_000;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
};

function getResponseText(response: ChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => part.text ?? "").join("").trim();
}

export async function proofreadCoordinatorObservation(observation?: string | null) {
  const original = observation?.trim() ?? "";
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!original || !apiKey) return original;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || DEFAULT_AI_GATEWAY_MODEL,
        temperature: 0,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content: [
              "Você é um revisor de textos escolares em português usado antes da emissão de relatórios.",
              "Corrija apenas erros claros de ortografia, acentuação, concordância, pontuação e capitalização.",
              "Preserve rigorosamente o significado, os factos, o tom, a pessoa gramatical e o nível de formalidade do texto.",
              "Não acrescente, remova ou invente informação. Não reformule frases corretas.",
              "Responda apenas com o texto revisto, sem aspas, comentários ou explicações.",
            ].join(" "),
          },
          { role: "user", content: original },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return original;
    const result = getResponseText(await response.json() as ChatCompletionResponse);
    return result || original;
  } catch (error) {
    console.warn("Coordinator observation proofreading unavailable; using original text.", error);
    return original;
  } finally {
    clearTimeout(timeout);
  }
}