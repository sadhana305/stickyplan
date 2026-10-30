import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson, vision } from "@/lib/ai";
import { readDocFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

type Extracted = {
  question: string;
  type?: string;
  marks?: number;
  options?: string[];
  answerInPaper?: string | null;
};

/**
 * Reads an uploaded question paper (already stored in My Study Library) and
 * extracts its questions for the student to review before saving.
 * Nothing is saved automatically — the review step is mandatory.
 */
export async function POST(req: Request) {
  const body = await parseBody<{ docId?: string }>(req);
  return withUser(async (user) => {
    if (!body.docId) throw new Error("Choose a question paper from your library first.");
    const doc = await db.libraryDoc.findFirst({ where: { id: body.docId, userId: user.id } });
    if (!doc) throw new Error("Document not found.");

    // Get readable text (OCR images on the fly)
    let text = doc.extractedText ?? "";
    if (doc.textState !== "READY" || text.trim().length < 20) {
      if (doc.kind === "IMAGE") {
        const file = await readDocFile(user.id, doc.id, doc.ext);
        if (!file) throw new Error("The stored image file is missing. Please re-upload it.");
        const raw = await vision(
          `Read ALL text from this exam/study question paper photo. Transcribe faithfully, keeping question numbers, marks in brackets, sub-questions and options. Write [unclear] for illegible words. Do not invent questions.`,
          `data:${doc.mime || "image/jpeg"};base64,${file.toString("base64")}`
        );
        text = raw.replace(/\u0000/g, "").trim();
        await db.libraryDoc.update({
          where: { id: doc.id },
          data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `Read with AI OCR (${Math.ceil(text.length / 1000)}k characters)` },
        });
      } else if (doc.kind === "PDF") {
        const file = await readDocFile(user.id, doc.id, doc.ext);
        if (!file) throw new Error("The stored PDF file is missing. Please re-upload it.");
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const result = await extractPdfText(file);
          text = result.text;
          if (text.length >= 20) {
            await db.libraryDoc.update({
              where: { id: doc.id },
              data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `${Math.ceil(text.length / 1000)}k characters read from the PDF` },
            });
          }
        } catch { /* handled below */ }
      }
    }

    if (text.trim().length < 20) {
      throw new Error(
        "Couldn't read enough text from this document. If it's a scanned paper or photo, make sure the image is sharp — or try a text-based PDF."
      );
    }

    const extracted = await chatJson<{ questions: Extracted[] }>(
      `You extract exam questions from question papers. Respond with ONLY valid JSON:
{"questions":[{"question":"full question text including sub-parts (a),(b) if present","type":"VERY_SHORT|SHORT|LONG|DESCRIPTIVE|NUMERICAL|APPLICATION|MCQ","marks":number,"options":["A. ...","B. ..."],"answerInPaper":"the model answer if the paper itself contains one, else null"}]}
Rules:
- Keep the original wording; do not rewrite or fix the questions.
- Detect marks from the paper (e.g. "[5]", "(2 marks)"). Default to 2 when unclear.
- For MCQs include the options.
- Extract at most 30 questions, in paper order.
- If the document contains no questions, return {"questions":[]}.`,
      `Question paper content:\n"""\n${text.slice(0, 30_000)}\n"""`
    );

    const questions = (extracted.questions ?? [])
      .filter((q) => q && typeof q.question === "string" && q.question.trim().length > 3)
      .slice(0, 30)
      .map((q, i) => ({
        key: `x${i + 1}`,
        question: q.question.trim().replace(/^\s*(?:Q\s*\d+|\d+)\s*[).:\-]\s*/i, "").slice(0, 2000),
        type: q.type ?? "SHORT",
        marks: Math.max(1, Math.min(25, Math.round(Number(q.marks) || 2))),
        options: Array.isArray(q.options) ? q.options.slice(0, 6).map((o) => String(o)) : undefined,
        answerInPaper: typeof q.answerInPaper === "string" && q.answerInPaper.trim() ? q.answerInPaper.trim().slice(0, 4000) : null,
      }));

    return { questions, docId: doc.id, docTitle: doc.name };
  });
}
