import ZAI from "z-ai-web-dev-sdk";

export type ChatMessage = { role: "assistant" | "user"; content: string };

export async function chat(messages: ChatMessage[], maxTokensHint?: string): Promise<string> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("The AI returned an empty response. Please try again.");
  return content;
}

/** Vision call: supports data URLs (base64 images) and file URLs. */
export async function vision(prompt: string, dataUrl: string): Promise<string> {
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.createVision({
    model: "glm-4.6v",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });
  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("The AI vision service returned an empty response.");
  return content;
}

/** Robustly extract a JSON value from an AI response (handles ``` fences and prose). */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  // Remove markdown code fences
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  // Try direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    /* continue */
  }
  // Find the first { or [ and matching last } or ]
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  let open = "{";
  let close = "}";
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    open = "[";
    close = "]";
  } else if (firstObj !== -1) {
    start = firstObj;
  }
  if (start === -1) throw new Error("AI did not return valid JSON. Please try again.");
  const lastClose = text.lastIndexOf(close);
  if (lastClose > start) {
    const candidate = text.slice(start, lastClose + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* continue */
    }
  }
  throw new Error("AI returned malformed JSON. Please try again.");
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const raw = await chat([
    { role: "assistant", content: system },
    { role: "user", content: user },
  ]);
  return extractJson<T>(raw);
}
