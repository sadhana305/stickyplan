import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson, vision } from "@/lib/ai";
import { readDocFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Matches answers from an uploaded answer PDF/image with the student's
 * questions. Returns PROPOSED matches only — the student reviews and corrects
 * them in the UI before anything is saved.
 */
export async function POST(req: Request) {
  const body = await parseBody<{ answerDocId?: string; questionIds?: string[] }>(req);
  return withUser(async (user) => {
    if (!body.answerDocId) throw new Error("Choose an answer document from your library first.");
    const answerDoc = await db.libraryDoc.findFirst({ where: { id: body.answerDocId, userId: user.id } });
    if (!answerDoc) throw new Error("Answer document not found.");

    const ids = (body.questionIds ?? []).slice(0, 30);
    if (ids.length === 0) throw new Error("Select the questions you want to match answers to.");
    const questions = await db.qbQuestion.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: { id: true, question: true, marks: true },
    });
    if (questions.length === 0) throw new Error("Those questions were not found in your bank.");

    // Read the answer document text (OCR images on the fly)
    let text = answerDoc.extractedText ?? "";
    if (answerDoc.textState !== "READY" || text.trim().length < 20) {
      if (answerDoc.kind === "IMAGE") {
        const file = await readDocFile(user.id, answerDoc.id, answerDoc.ext);
        if (!file) throw new Error("The stored answer image is missing. Please re-upload it.");
        const raw = await vision(
          `Read ALL text from this answer sheet / solutions photo. Transcribe faithfully, keeping question numbers and answers together. Write [unclear] for illegible words.`,
          `data:${answerDoc.mime || "image/jpeg"};base64,${file.toString("base64")}`
        );
        text = raw.replace(/\u0000/g, "").trim();
        await db.libraryDoc.update({
          where: { id: answerDoc.id },
          data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `Read with AI OCR (${Math.ceil(text.length / 1000)}k characters)` },
        });
      } else if (answerDoc.kind === "PDF") {
        const file = await readDocFile(user.id, answerDoc.id, answerDoc.ext);
        if (!file) throw new Error("The stored answer PDF is missing. Please re-upload it.");
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const result = await extractPdfText(file);
          text = result.text;
          if (text.length >= 20) {
            await db.libraryDoc.update({
              where: { id: answerDoc.id },
              data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `${Math.ceil(text.length / 1000)}k characters read from the PDF` },
            });
          }
        } catch { /* handled below */ }
      }
    }

    if (text.trim().length < 20) {
      throw new Error("Couldn't read enough text from the answer document. Try a sharper photo or a text-based PDF.");
    }

    const matched = await chatJson<{ matches: { id: string; answer: string; confident: boolean }[] }>(
      `You match answers to exam questions using an answer sheet. Respond with ONLY valid JSON:
{"matches":[{"id":"the question id","answer":"the matching answer copied faithfully from the answer sheet","confident":true}]}
Rules:
- Match by question number and wording; be strict.
- If an answer is missing or unclear in the sheet, omit that id (do not guess).
- Keep the answer text as it appears in the sheet (light cleanup only).`,
      `Questions:\n${questions.map((q) => `id=${q.id} | ${q.marks} marks | ${q.question.slice(0, 300)}`).join("\n")}\n\nAnswer sheet content:\n"""\n${text.slice(0, 30_000)}\n"""`
    );

    const byId = new Map<string, { answer: string; confident: boolean }>();
    for (const m of matched.matches ?? []) {
      if (m && typeof m.id === "string" && typeof m.answer === "string" && m.answer.trim()) {
        byId.set(m.id, { answer: m.answer.trim().slice(0, 6000), confident: m.confident !== false });
      }
    }

    return {
      matches: questions.map((q) => ({
        id: q.id,
        question: q.question,
        marks: q.marks,
        answer: byId.get(q.id)?.answer ?? null,
        confident: byId.get(q.id)?.confident ?? false,
      })),
      matchedCount: byId.size,
    };
  });
}
