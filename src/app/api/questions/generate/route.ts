import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson } from "@/lib/ai";

export const maxDuration = 120;

const QUESTION_TYPES = ["MCQ", "VERY_SHORT", "SHORT", "LONG", "DESCRIPTIVE", "NUMERICAL", "APPLICATION"];

type GenQuestion = {
  type: string;
  marks: number;
  question: string;
  options?: string[] | null;
  answer: string;
  keywords: string[];
  structure: string;
  example: string;
};

export async function POST(req: Request) {
  const body = await parseBody<{
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    marks?: number[];
    types?: string[];
    count?: number;
  }>(req);
  return withUser(async (user) => {
    // Resolve scope
    const topicWhere = { userId: user.id, ...(body.topicId ? { id: body.topicId } : {}) };
    let scopeLabel = "Your syllabus";
    let topicContext = "";

    if (body.topicId) {
      const topic = await db.topic.findFirst({
        where: topicWhere,
        include: { subject: { select: { name: true } }, chapter: { select: { name: true } } },
      });
      if (!topic) throw new Error("Topic not found.");
      scopeLabel = `${topic.name} (${topic.subject.name})`;
      topicContext = `Focus topic: "${topic.name}" in chapter "${topic.chapter.name}", subject "${topic.subject.name}".`;
    } else if (body.chapterId) {
      const chapter = await db.chapter.findFirst({
        where: { id: body.chapterId, subject: { userId: user.id } },
        include: { subject: { select: { name: true } }, topics: { select: { name: true, difficulty: true } } },
      });
      if (!chapter) throw new Error("Chapter not found.");
      scopeLabel = `${chapter.name} (${chapter.subject.name})`;
      topicContext = `Subject: "${chapter.subject.name}". Chapter: "${chapter.name}". Chapter topics: ${chapter.topics.map((t) => t.name).join("; ")}.`;
    } else if (body.subjectId) {
      const subject = await db.subject.findFirst({
        where: { id: body.subjectId, userId: user.id },
        include: { topics: { select: { name: true } }, chapters: { select: { name: true } } },
      });
      if (!subject) throw new Error("Subject not found.");
      scopeLabel = subject.name;
      topicContext = `Subject: "${subject.name}". Chapters: ${subject.chapters.map((c) => c.name).join("; ") || "unknown"}. Sample topics: ${subject.topics.slice(0, 25).map((t) => t.name).join("; ") || "unknown"}.`;
    } else {
      const subjects = await db.subject.findMany({
        where: { userId: user.id },
        include: { topics: { select: { name: true }, take: 10 } },
      });
      if (subjects.length === 0) throw new Error("Add your syllabus first, then generate questions.");
      topicContext = `Subjects: ${subjects.map((s) => `${s.name} (topics: ${s.topics.map((t) => t.name).join(", ")})`).join(" | ")}.`;
    }

    const marks = (body.marks ?? [2, 5]).filter((m) => m >= 1 && m <= 25).slice(0, 6);
    const types = (body.types ?? ["MCQ", "SHORT", "LONG"]).filter((t) => QUESTION_TYPES.includes(t));
    const count = Math.max(1, Math.min(15, body.count ?? 6));
    if (marks.length === 0) throw new Error("Choose at least one mark category.");

    const questions = await chatJson<{ questions: GenQuestion[] }>(
      `You are an experienced exam paper setter. Generate exam-oriented questions and respond with ONLY valid JSON (no markdown) shaped exactly:
{"questions":[{"type":"MCQ","marks":2,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"the correct option text","keywords":["key","words"],"structure":"how to structure a good answer","example":"a supporting example or application"}]}
Rules:
- "type" must be one of: ${types.join(", ")}.
- "marks" must be one of: ${marks.join(", ")}.
- Generate exactly ${count} questions, spread across the requested types and marks.
- MCQ/VERY_SHORT: options only for MCQ (4 options); answer must be the exact correct option text.
- LONG/DESCRIPTIVE (10+ marks): the answer should be a model answer outline with sections and expected depth.
- NUMERICAL: include worked solution steps in "answer".
- "keywords" = 3-8 terms a marking scheme would look for.
- Questions must be grounded in the provided topics only. Do not invent content outside them.`,
      `${topicContext}\n\nCreate ${count} exam questions (${types.join(", ")}) across ${marks.join(", ")} marks, exam-oriented and varied.`
    );

    const valid = (questions.questions ?? []).filter((q) => q.question && q.answer);
    if (valid.length === 0) throw new Error("The AI could not generate questions for this scope. Try a broader selection.");

    const set = await db.questionSet.create({
      data: {
        userId: user.id,
        title: `${scopeLabel} • ${marks.join("/")} marks`,
        params: JSON.stringify({ marks, types, count, scopeLabel }),
        questions: JSON.stringify(valid),
      },
    });
    return { setId: set.id, title: set.title, questions: valid };
  });
}
