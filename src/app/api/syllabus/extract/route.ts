import { chatJson, vision } from "@/lib/ai";
import { withUser, parseBody } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const maxDuration = 120;

type ExtractedTopic = { name: string; subtopics?: string[] };
type ExtractedChapter = { name: string; topics?: ExtractedTopic[] };
type ExtractedSubject = { name: string; chapters?: ExtractedChapter[] };

const SCHEMA_PROMPT = `You are a syllabus parsing assistant for a study app.
From the provided syllabus content, extract the complete structure and respond with ONLY valid JSON (no markdown, no commentary) in this exact shape:
{"subjects":[{"name":"Subject name","chapters":[{"name":"Chapter name","topics":[{"name":"Topic name","subtopics":["Subtopic 1"]}]}]}]}
Rules:
- Keep subject, chapter and topic names concise and faithful to the document.
- Only include subtopics when the document clearly lists them.
- If the content is not a syllabus, return {"subjects":[]}.
- Do not invent content that is not in the document.`;

export async function POST(req: Request) {
  const body = await parseBody<{
    mode?: "text" | "image" | "pdf";
    text?: string;
    base64?: string;
    mime?: string;
    fileName?: string;
  }>(req);
  return withUser(async () => {
    const mode = body.mode ?? "text";

    if (mode === "text") {
      const text = (body.text ?? "").trim();
      if (text.length < 20) throw new Error("Please paste a bit more of your syllabus so it can be recognised.");
      const trimmed = text.slice(0, 15000);
      const extracted = await chatJson<{ subjects: ExtractedSubject[] }>(
        SCHEMA_PROMPT,
        `Syllabus content:\n\n${trimmed}`
      );
      return { extracted: extracted.subjects ?? [], source: "text" };
    }

    if (mode === "image") {
      const { base64, mime } = body;
      if (!base64) throw new Error("No image received.");
      const okMimes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
      const m = okMimes.includes(mime ?? "") ? mime! : "image/jpeg";
      const raw = await vision(
        `This is a photo of a study syllabus page. Extract its structure and respond with ONLY valid JSON (no markdown) in this shape:
{"subjects":[{"name":"Subject name","chapters":[{"name":"Chapter name","topics":[{"name":"Topic name","subtopics":["Subtopic 1"]}]}]}]}
Keep names faithful to the document. If the photo does not contain a syllabus, return {"subjects":[]}.`,
        `data:${m};base64,${base64}`
      );
      const extracted = await chatJson<{ subjects: ExtractedSubject[] }>(SCHEMA_PROMPT, `OCR text from the syllabus photo:\n\n${raw.slice(0, 12000)}`);
      return { extracted: extracted.subjects ?? [], source: "image" };
    }

    if (mode === "pdf") {
      const { base64 } = body;
      if (!base64) throw new Error("No PDF received.");
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > 12 * 1024 * 1024) throw new Error("That PDF is too large (max 12 MB).");
      let text = "";
      try {
        const { extractPdfText } = await import("@/lib/pdf");
        const result = await extractPdfText(buffer);
        text = result.text ?? "";
      } catch {
        throw new Error(
          "Couldn't read text from this PDF (it may be a scanned image). Please upload photos of the pages instead, or paste the text."
        );
      }
      if (text.trim().length < 20)
        throw new Error(
          "No readable text found in this PDF (it may be a scanned image). Please upload photos of the pages instead, or paste the text."
        );
      const extracted = await chatJson<{ subjects: ExtractedSubject[] }>(
        SCHEMA_PROMPT,
        `Syllabus content:\n\n${text.slice(0, 15000)}`
      );
      return { extracted: extracted.subjects ?? [], source: "pdf" };
    }

    throw new Error("Unsupported extraction mode.");
  });
}
