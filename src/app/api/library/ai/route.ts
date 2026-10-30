import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chat, chatJson, vision } from "@/lib/ai";
import { readDocFile } from "@/lib/storage";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROMPT_BUDGET = 30_000; // characters of document text sent to the AI

type LibraryDoc = {
  id: string;
  userId: string;
  name: string;
  kind: string;
  mime: string;
  ext: string;
  extractedText: string;
  textState: string;
  textNote: string;
  aiResults: string;
};

type AiResults = Record<string, unknown>;

const GROUNDING = `Rules you must follow:
- Use ONLY the document content provided. Never invent facts, formulas, questions or terms that are not there.
- If the document does not contain something that was asked for, say so clearly instead of guessing.
- If parts of the document are unclear or unreadable, mention that.`;

/** Load a doc owned by the user. */
async function getDoc(userId: string, docId: string): Promise<LibraryDoc> {
  const doc = await db.libraryDoc.findFirst({ where: { id: docId, userId } });
  if (!doc) throw new Error("Document not found.");
  return doc as LibraryDoc;
}

/** Make sure we have readable text for the AI; OCR images on first use and cache the result. */
async function ensureText(userId: string, doc: LibraryDoc): Promise<{ text: string; truncated: boolean }> {
  if (doc.textState === "READY" && doc.extractedText.trim().length >= 20) {
    return { text: doc.extractedText, truncated: doc.extractedText.length > PROMPT_BUDGET };
  }

  if (doc.kind === "IMAGE") {
    const file = await readDocFile(userId, doc.id, doc.ext);
    if (!file) throw new Error("The stored image file is missing. Please re-upload it.");
    const mime = doc.mime || "image/jpeg";
    const raw = await vision(
      `Read ALL text from this study document photo (it may be handwritten or printed). Transcribe it faithfully, keeping headings, question numbers, formulas and lists. If some words are illegible, write [unclear]. Do not add anything that is not visible.`,
      `data:${mime};base64,${file.toString("base64")}`
    );
    const text = raw.replace(/\u0000/g, "").trim();
    if (text.length < 10) {
      await db.libraryDoc.update({
        where: { id: doc.id },
        data: { textState: "EMPTY", textNote: "The AI could not read enough text from this image. Try a sharper, well-lit photo." },
      });
      throw new Error("The AI could not read enough text from this image. Try a sharper, well-lit photo.");
    }
    await db.libraryDoc.update({
      where: { id: doc.id },
      data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `Read with AI OCR (${Math.ceil(text.length / 1000)}k characters)` },
    });
    return { text, truncated: text.length > PROMPT_BUDGET };
  }

  if (doc.kind === "PDF") {
    const file = await readDocFile(userId, doc.id, doc.ext);
    if (!file) throw new Error("The stored PDF file is missing. Please re-upload it.");
    try {
      const { extractPdfText } = await import("@/lib/pdf");
      const result = await extractPdfText(file);
      const text = result.text;
      if (text.length >= 20) {
        await db.libraryDoc.update({
          where: { id: doc.id },
          data: { extractedText: text.slice(0, 200_000), textState: "READY", textNote: `${Math.ceil(text.length / 1000)}k characters read from the PDF` },
        });
        return { text, truncated: text.length > PROMPT_BUDGET };
      }
    } catch { /* fall through */ }
    throw new Error(
      "No readable text in this PDF — it looks like a scanned copy. Upload photos of its pages instead; the AI reads images with OCR."
    );
  }

  throw new Error("This document has no readable text yet. Open it and press “Read with AI” first.");
}

async function cacheResult(docId: string, key: string, value: unknown) {
  const doc = await db.libraryDoc.findUnique({ where: { id: docId }, select: { aiResults: true } });
  let results: AiResults = {};
  try {
    results = JSON.parse(doc?.aiResults ?? "{}") as AiResults;
  } catch { /* reset */ }
  results[key] = value;
  await db.libraryDoc.update({ where: { id: docId }, data: { aiResults: JSON.stringify(results).slice(0, 500_000) } });
}

function readCache(doc: LibraryDoc, key: string): unknown {
  try {
    return (JSON.parse(doc.aiResults) as AiResults)[key];
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  const body = await parseBody<{
    docId?: string;
    action?: string;
    question?: string;
    questions?: string[];
  }>(req);
  return withUser(async (user) => {
    if (!body.docId || !body.action) throw new Error("Missing document or action.");
    let doc = await getDoc(user.id, body.docId);
    const { text: rawText, truncated } = await ensureText(user.id, doc);
    if (doc.textState !== "READY") doc = (await getDoc(user.id, body.docId)) as LibraryDoc;
    const text = rawText.slice(0, PROMPT_BUDGET);
    const source = `Document name: "${doc.name}"\nDocument content:\n"""\n${text}\n"""${truncated ? `\n(Note: the document is long — you were given its beginning. Work with what is provided.)` : ""}`;

    switch (body.action) {
      case "read": {
        return { textState: "READY", message: doc.textNote || "Document text is ready.", chars: rawText.length };
      }

      case "summarize": {
        const cached = readCache(doc, "summarize");
        if (cached) return { summarize: cached, cached: true };
        const out = await chat(
          [
            { role: "assistant", content: `You turn study documents into easy-to-understand revision notes. Use clear markdown with short sections and bullets. ${GROUNDING}` },
            { role: "user", content: `Summarise this document into easy-to-understand study notes.\n\n${source}` },
          ],
          "summarize"
        );
        await cacheResult(doc.id, "summarize", out);
        return { summarize: out };
      }

      case "explain": {
        const cached = readCache(doc, "explain");
        if (cached) return { explain: cached, cached: true };
        const out = await chat(
          [
            { role: "assistant", content: `You are a patient tutor who explains difficult material in simple language, with everyday analogies. Use markdown. ${GROUNDING}` },
            { role: "user", content: `Explain the difficult parts of this document in simple language a student can follow.\n\n${source}` },
          ],
          "explain"
        );
        await cacheResult(doc.id, "explain", out);
        return { explain: out };
      }

      case "keypoints": {
        const cached = readCache(doc, "keypoints");
        if (cached) return { keypoints: cached, cached: true };
        const out = await chatJson<{ keyPoints: string[]; definitions: { term: string; meaning: string }[]; formulas: { name: string; expression: string }[] }>(
          `You extract the important points from study documents. Respond with ONLY valid JSON (no markdown fences):
{"keyPoints":["..."],"definitions":[{"term":"...","meaning":"..."}],"formulas":[{"name":"...","expression":"..."}]}
Rules: 5-12 key points; include only definitions and formulas actually present in the document (use [] if none). ${GROUNDING}`,
          `Extract the important definitions, formulas and key concepts from this document.\n\n${source}`
        );
        await cacheResult(doc.id, "keypoints", out);
        return { keypoints: out };
      }

      case "questions": {
        const cached = readCache(doc, "questions");
        if (cached) return { questions: cached, cached: true };
        const out = await chatJson<{ questions: { question: string; type: string; marks: number; answerHint?: string }[] }>(
          `You create exam-style questions strictly from study documents. Respond with ONLY valid JSON:
{"questions":[{"question":"...","type":"VERY_SHORT|SHORT|LONG|NUMERICAL|APPLICATION","marks":1|2|5|10|13|16,"answerHint":"brief marking-point hint"}]}
Rules: 6-10 questions; sensible mark weightings; cover different parts of the document; never invent content. ${GROUNDING}`,
          `Create practice questions from this document.\n\n${source}`
        );
        await cacheResult(doc.id, "questions", out);
        return { questions: out.questions };
      }

      case "answers": {
        const questions = (body.questions ?? []).map((q) => String(q).trim()).filter(Boolean).slice(0, 12);
        if (questions.length === 0) throw new Error("Add or select the questions you want answers for first.");
        const out = await chatJson<{ answers: { question: string; answer: string }[] }>(
          `You answer exam questions strictly from the provided study document. Respond with ONLY valid JSON:
{"answers":[{"question":"the exact question asked","answer":"a clear model answer with the key points, sized to the marks"}]}
If the document does not contain enough information for a question, set the answer to "Not covered in this document." ${GROUNDING}`,
          `Questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nAnswer each question using only this document.\n\n${source}`
        );
        return { answers: out.answers };
      }

      case "quiz": {
        const out = await chatJson<{
          questions: { question: string; type: "MCQ" | "TRUE_FALSE" | "FILL_BLANK"; options?: string[]; answer: string | string[]; explanation: string }[];
        }>(
          `You build short objective quizzes strictly from study documents. Respond with ONLY valid JSON:
{"questions":[{"question":"...","type":"MCQ","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"B. ...","explanation":"why, based on the document"},{"question":"...","type":"TRUE_FALSE","answer":"True|False","explanation":"..."},{"question":"Fill in the blank: ...","type":"FILL_BLANK","answer":["word"],"explanation":"..."}]}
Rules: exactly 6 questions mixing the types; for MCQ put the full correct option text as the answer; never invent content. ${GROUNDING}`,
          `Make a quick quiz from this document.\n\n${source}`
        );
        const shaped = (out.questions ?? []).slice(0, 8).map((q, i) => ({
          id: `dq${i + 1}`,
          type: q.type,
          topicId: null,
          topicName: doc.name,
          question: q.question,
          options: q.options ?? undefined,
          answer: q.answer,
          explanation: q.explanation,
        }));
        if (shaped.length < 3) throw new Error("The AI could not build a quiz from this document — try a text-richer file.");
        const quiz = await db.quiz.create({
          data: {
            userId: user.id,
            date: todayStr(),
            topicIds: "[]",
            questions: JSON.stringify(shaped),
          },
        });
        return { quizId: quiz.id, questions: shaped };
      }

      case "flashcards": {
        const cached = readCache(doc, "flashcards");
        if (cached) return { flashcards: cached, cached: true };
        const out = await chatJson<{ flashcards: { front: string; back: string }[] }>(
          `You make revision flashcards strictly from study documents. Respond with ONLY valid JSON:
{"flashcards":[{"front":"question or term","back":"answer or definition"}]}
Rules: 6-12 cards; front is a question/term that appears in the document; never invent content. ${GROUNDING}`,
          `Create revision flashcards from this document.\n\n${source}`
        );
        await cacheResult(doc.id, "flashcards", out.flashcards);
        return { flashcards: out.flashcards };
      }

      case "ask": {
        const question = (body.question ?? "").trim();
        if (!question) throw new Error("Type a question about the document first.");
        const answer = await chat(
          [
            { role: "assistant", content: `You answer questions about one specific document. If the answer is not in the document, say exactly that and suggest what to check. Be concise and clear. Use markdown. ${GROUNDING}` },
            { role: "user", content: `${source}\n\nStudent's question: ${question}` },
          ],
          "ask"
        );
        return { answer };
      }

      default:
        throw new Error("Unknown action.");
    }
  });
}

export async function GET(req: Request) {
  const docId = new URL(req.url).searchParams.get("docId");
  return withUser(async (user) => {
    if (!docId) throw new Error("Missing docId.");
    const doc = await db.libraryDoc.findFirst({ where: { id: docId, userId: user.id }, select: { aiResults: true, textState: true, textNote: true, extractedText: true } });
    if (!doc) throw new Error("Document not found.");
    let results: AiResults = {};
    try {
      results = JSON.parse(doc.aiResults) as AiResults;
    } catch { /* ignore */ }
    return { results, textState: doc.textState, textNote: doc.textNote, chars: doc.extractedText.length, text: doc.extractedText.slice(0, 200_000) };
  });
}
