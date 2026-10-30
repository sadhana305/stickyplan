import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { todayStr } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Builds a quiz from selected questions in the student's bank.
 * Questions WITHOUT any answer (original or AI draft) are skipped honestly —
 * the grader needs a model answer to compare against.
 */
export async function POST(req: Request) {
  const body = await parseBody<{ ids?: string[] }>(req);
  return withUser(async (user) => {
    const ids = (body.ids ?? []).slice(0, 20);
    if (ids.length === 0) throw new Error("Select the questions you want to practise first.");

    const rows = await db.qbQuestion.findMany({ where: { id: { in: ids }, userId: user.id }, orderBy: { marks: "asc" } });
    if (rows.length === 0) throw new Error("Those questions were not found.");

    const shaped: {
      id: string;
      type: string;
      topicId: null;
      topicName: string;
      question: string;
      options?: string[];
      answer: string | string[];
      keywords: string[];
      explanation: string;
    }[] = [];
    const skipped: string[] = [];
    for (const q of rows) {
      const modelAnswer = q.answer ?? q.aiAnswer;
      if (!modelAnswer || !modelAnswer.trim()) {
        skipped.push(q.question.slice(0, 60));
        continue;
      }
      let options: string[] | undefined;
      if (q.type === "MCQ") {
        try {
          options = q.options ? (JSON.parse(q.options) as string[]) : undefined;
        } catch { /* ignore */ }
      }
      shaped.push({
        id: q.id,
        type: ["MCQ", "TRUE_FALSE", "FILL_BLANK"].includes(q.type) ? q.type : "SHORT",
        topicId: null,
        topicName: `${q.marks} marks · ${q.subjectName || q.docTitle || "My Q&A Bank"}`,
        question: q.question,
        options,
        answer: q.type === "FILL_BLANK" ? [modelAnswer] : modelAnswer,
        keywords: [] as string[],
        explanation: `Model answer ${q.answerSource === "ai" ? "(AI draft)" : q.answerSource === "original" ? "(from your material)" : ""} for: ${q.question.slice(0, 140)}`,
      });
    }

    if (shaped.length < 3) {
      throw new Error(
        skipped.length > 0
          ? "Almost all selected questions have no answer yet — add answers (or generate AI drafts) first so the quiz can be graded fairly."
          : "Pick at least 3 questions with answers to build a quiz."
      );
    }

    const quiz = await db.quiz.create({
      data: { userId: user.id, date: todayStr(), topicIds: "[]", questions: JSON.stringify(shaped) },
    });

    return { quizId: quiz.id, questions: shaped, skippedCount: skipped.length };
  });
}
