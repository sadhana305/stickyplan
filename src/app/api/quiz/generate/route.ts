import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson } from "@/lib/ai";
import { todayStr } from "@/lib/dates";

export const maxDuration = 120;

type QuizQuestion = {
  id: string;
  type: string;
  topicId: string | null;
  topicName: string;
  question: string;
  options?: string[];
  answer: string | string[] | Record<string, string>;
  keywords?: string[];
  explanation: string;
};

const QUIZ_SCHEMA = `You are a quiz master for a study app. Respond with ONLY valid JSON (no markdown) shaped exactly:
{"questions":[
{"type":"MCQ","topicName":"...","question":"...","options":["opt1","opt2","opt3","opt4"],"answer":"exact text of the correct option","explanation":"why"},
{"type":"TRUE_FALSE","topicName":"...","question":"a statement that is clearly true or false","answer":"True","explanation":"why"},
{"type":"FILL_BLANK","topicName":"...","question":"sentence with a ______ blank","answer":["acceptable answer 1","acceptable answer 2"],"explanation":"why"},
{"type":"MATCH","topicName":"...","question":"Match the pairs:","left":["item 1","item 2","item 3"],"right":["shuffled match 1","shuffled match 2","shuffled match 3"],"correct":{"0":"the right-side item matching left item 0","1":"...","2":"..."},"explanation":"pairs explained"},
{"type":"SHORT","topicName":"...","question":"...","answer":"model short answer (2-4 sentences)","keywords":["3-6 marking keywords"],"explanation":"marking guidance"},
{"type":"APPLICATION","topicName":"...","question":"a scenario/application question","answer":"model answer","keywords":["3-6 marking keywords"],"explanation":"marking guidance"}
]}
Rules:
- "type" must be one of MCQ, TRUE_FALSE, FILL_BLANK, MATCH, SHORT, APPLICATION.
- "answer" for TRUE_FALSE is exactly "True" or "False".
- "right" array must be a shuffled version of the correct matches; "correct" maps left index (as string) to the exact right-side value.
- Every question must be answerable from the given topics only. Do not invent outside content.`;

export async function POST(req: Request) {
  const body = await parseBody<{
    scope?: "today" | "custom";
    subjectId?: string;
    chapterId?: string;
    topicIds?: string[];
  }>(req);
  return withUser(async (user) => {
    const today = todayStr();
    let topics: { id: string; name: string; difficulty: string; subject: { name: string } }[] = [];

    if (body.scope !== "custom") {
      const planItems = await db.planItem.findMany({
        where: { userId: user.id, date: today, topicId: { not: null }, type: "LEARN" },
        include: { topic: { include: { subject: { select: { name: true } } } } },
      });
      topics = planItems
        .map((p) => p.topic)
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty, subject: t.subject }));
      if (topics.length === 0) {
        // fall back to revisions due today
        const revs = await db.revisionItem.findMany({
          where: { userId: user.id, dueDate: { lte: today }, completed: false },
          include: { topic: { include: { subject: { select: { name: true } } } } },
          take: 4,
        });
        topics = revs.map((r) => ({ id: r.topic.id, name: r.topic.name, difficulty: r.topic.difficulty, subject: r.topic.subject }));
        if (topics.length === 0)
          throw new Error(
            "Nothing is scheduled for today yet. Generate a study plan first, or create a custom quiz from a subject or chapter."
          );
      }
    } else {
      if (body.topicIds && body.topicIds.length > 0) {
        const found = await db.topic.findMany({
          where: { userId: user.id, id: { in: body.topicIds } },
          include: { subject: { select: { name: true } } },
        });
        topics = found.map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty, subject: t.subject }));
      } else if (body.chapterId) {
        const chapter = await db.chapter.findFirst({
          where: { id: body.chapterId, subject: { userId: user.id } },
          include: { topics: { include: { subject: { select: { name: true } } }, take: 4 } },
        });
        if (!chapter) throw new Error("Chapter not found.");
        topics = chapter.topics.map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty, subject: t.subject }));
      } else if (body.subjectId) {
        const subject = await db.subject.findFirst({
          where: { id: body.subjectId, userId: user.id },
          include: { topics: { take: 4, orderBy: { createdAt: "asc" } } },
        });
        if (!subject) throw new Error("Subject not found.");
        topics = subject.topics.map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty, subject: { name: subject.name } }));
      }
      if (topics.length === 0) throw new Error("Pick at least one topic, chapter or subject for the quiz.");
      topics = topics.slice(0, 4);
    }

    const count = topics.length >= 4 ? 8 : 6;
    const topicList = topics.map((t) => `"${t.name}" (subject: ${t.subject.name})`).join("; ");
    const n = (t: string, k: number) => `${k} ${t} question${k === 1 ? "" : "s"}`;

    const generated = await chatJson<{ questions: Omit<QuizQuestion, "id" | "topicId">[] }>(
      QUIZ_SCHEMA,
      `Create a ${count}-question quiz covering ONLY these topics: ${topicList}.
Composition: ${n("MCQ", 2)}, ${n("TRUE_FALSE", 1)}, ${n("FILL_BLANK", 1)}, ${n("MATCH", 1)}, ${n("SHORT", Math.max(1, count - 6))}, ${n("APPLICATION", count >= 8 ? 1 : 0) || "skip APPLICATION"}. Adjust counts so the total is exactly ${count}; cover the different topics across questions.`
    );

    const valid = (generated.questions ?? []).filter((q) => q.question && q.answer);
    if (valid.length < 3) throw new Error("The AI could not build this quiz. Please try again.");

    const questions: QuizQuestion[] = valid.map((q, i) => ({
      ...q,
      id: `q${i + 1}`,
      topicId: topics.find((t) => t.name.toLowerCase() === (q.topicName ?? "").toLowerCase())?.id ?? topics[i % topics.length].id,
      topicName: q.topicName || topics[i % topics.length].name,
    }));

    const quiz = await db.quiz.create({
      data: {
        userId: user.id,
        date: today,
        topicIds: JSON.stringify(topics.map((t) => t.id)),
        questions: JSON.stringify(questions),
      },
    });

    // Client gets questions WITHOUT answers
    const safeQuestions = questions.map(({ answer: _a, keywords: _k, ...rest }) => {
      void _a;
      void _k;
      return rest;
    });

    return { quizId: quiz.id, questions: safeQuestions, topics: topics.map((t) => t.name) };
  });
}
