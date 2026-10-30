import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chat } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Generates a DRAFT answer for a question in the student's bank.
 * The draft is stored separately (aiAnswer) and always labelled as
 * AI-generated in the UI — the student's own answers are never overwritten.
 */
export async function POST(req: Request) {
  const body = await parseBody<{ id?: string }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing question id.");
    const q = await db.qbQuestion.findFirst({ where: { id: body.id, userId: user.id } });
    if (!q) throw new Error("Question not found.");

    let grounding = "";
    if (q.docId) {
      const doc = await db.libraryDoc.findFirst({
        where: { id: q.docId, userId: user.id },
        select: { extractedText: true, textState: true, name: true },
      });
      if (doc && doc.textState === "READY" && doc.extractedText.trim().length > 40) {
        grounding = `\n\nThe student uploaded the source document "${doc.name}". Prefer its content for the answer (still correct any obvious slips in the question):\n"""\n${doc.extractedText.slice(0, 20_000)}\n"""`;
      }
    }

    const answer = await chat(
      [
        {
          role: "assistant",
          content:
            "You write exam-style model answers for students. Structure the answer to the marks: 1-2 marks → 2-4 crisp lines; 5 marks → key points with tiny explanations; 10+ marks → short intro, structured points, example. Use markdown bullets. Be accurate; if the question is ambiguous, answer the most standard interpretation and say so.",
        },
        {
          role: "user",
          content: `Question (${q.marks} marks, type ${q.type}): ${q.question}\nSubject: ${q.subjectName || "general"} | Chapter: ${q.chapterName || "—"} | Topic: ${q.topicName || "—"}${grounding}`,
        },
      ],
      "ai-answer"
    );

    const updated = await db.qbQuestion.update({
      where: { id: q.id },
      data: { aiAnswer: answer.slice(0, 6000) },
    });
    return { aiAnswer: updated.aiAnswer, note: "AI-generated draft — review it before relying on it in an exam." };
  });
}
