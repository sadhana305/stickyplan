import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson } from "@/lib/ai";
import { todayStr } from "@/lib/dates";
import { computeStreak } from "@/lib/streak";
import { ensureRevision } from "@/app/api/topics/route";

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

function norm(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\.$/, "");
}

export async function POST(req: Request) {
  const body = await parseBody<{ quizId?: string; answers?: Record<string, string>; timeSec?: number }>(req);
  return withUser(async (user) => {
    if (!body.quizId) throw new Error("Missing quiz.");
    const quiz = await db.quiz.findFirst({ where: { id: body.quizId, userId: user.id } });
    if (!quiz) throw new Error("Quiz not found.");
    if (quiz.completed) throw new Error("This quiz was already submitted.");

    const questions = JSON.parse(quiz.questions) as QuizQuestion[];
    const answers = body.answers ?? {};

    // ---- objective grading ----
    type Result = {
      id: string;
      type: string;
      topicName: string;
      given: string;
      expected: string;
      correct: number; // 0..1
      explanation: string;
      feedback?: string;
    };
    const results: Result[] = [];
    const subjective: { q: QuizQuestion; given: string }[] = [];

    for (const q of questions) {
      const given = (answers[q.id] ?? "").trim();
      if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
        const expected = Array.isArray(q.answer) ? q.answer[0] : String(q.answer);
        const correct = norm(given) === norm(expected) ? 1 : 0;
        results.push({ id: q.id, type: q.type, topicName: q.topicName, given, expected, correct, explanation: q.explanation });
      } else if (q.type === "FILL_BLANK") {
        const acceptables = Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer)];
        const correct = acceptables.some((a) => norm(given) === norm(a) || norm(a).includes(norm(given)) && norm(given).length > 2) ? 1 : 0;
        results.push({
          id: q.id,
          type: q.type,
          topicName: q.topicName,
          given,
          expected: acceptables[0],
          correct,
          explanation: q.explanation,
        });
      } else if (q.type === "MATCH") {
        const correctMap = (q.answer ?? {}) as Record<string, string>;
        const givenMap = (() => {
          try {
            return JSON.parse(given || "{}") as Record<string, string>;
          } catch {
            return {} as Record<string, string>;
          }
        })();
        const entries = Object.entries(correctMap);
        const right = entries.filter(([left, rightVal]) => norm(givenMap[left] ?? "") === norm(rightVal)).length;
        const correct = entries.length > 0 ? right / entries.length : 0;
        results.push({
          id: q.id,
          type: q.type,
          topicName: q.topicName,
          given: givenMap && Object.keys(givenMap).length > 0 ? `${right}/${entries.length} pairs correct` : "—",
          expected: entries.map(([l, r]) => `${l + 1}: ${r}`).join(", "),
          correct,
          explanation: q.explanation,
        });
      } else {
        subjective.push({ q, given });
        results.push({
          id: q.id,
          type: q.type,
          topicName: q.topicName,
          given: given || "—",
          expected: Array.isArray(q.answer) ? q.answer.join("; ") : String(q.answer),
          correct: -1, // pending AI grade
          explanation: q.explanation,
        });
      }
    }

    // ---- AI grading for subjective answers ----
    const toGrade = subjective.filter((s) => s.given.length > 0);
    if (toGrade.length > 0) {
      try {
        const graded = await chatJson<{ grades: { id: string; score: number; feedback: string }[] }>(
          `You are a strict but fair exam grader. Grade each student answer against its model answer and keywords. Respond with ONLY valid JSON: {"grades":[{"id":"q1","score":0.75,"feedback":"one short sentence on what was right/missing"}]}
score rules: 1.0 = fully correct, 0.5 = partially correct, 0.0 = wrong or irrelevant.`,
          toGrade
            .map(
              (s) =>
                `ID: ${s.q.id}\nQuestion: ${s.q.question}\nModel answer: ${String(s.q.answer)}\nKeywords: ${(s.q.keywords ?? []).join(", ")}\nStudent answer: ${s.given}`
            )
            .join("\n---\n")
        );
        for (const g of graded.grades ?? []) {
          const r = results.find((x) => x.id === g.id && x.correct === -1);
          if (r) {
            r.correct = Math.max(0, Math.min(1, Number(g.score) || 0));
            r.feedback = g.feedback;
          }
        }
      } catch {
        // Keyword-overlap fallback
        for (const s of toGrade) {
          const r = results.find((x) => x.id === s.q.id && x.correct === -1);
          if (!r) continue;
          const kws = s.q.keywords ?? [];
          const hits = kws.filter((k) => norm(s.given).includes(norm(k))).length;
          const ratio = kws.length > 0 ? hits / kws.length : s.given.length > 40 ? 0.5 : 0.25;
          r.correct = ratio >= 0.6 ? 1 : ratio >= 0.3 ? 0.5 : 0;
          r.feedback = "Graded by keyword matching (AI grader unavailable).";
        }
      }
    }
    for (const s of subjective) {
      const r = results.find((x) => x.id === s.q.id);
      if (r && r.correct === -1) r.correct = 0;
      if (r && !r.feedback) r.feedback = s.given ? "" : "No answer given.";
    }

    // ---- score + persist ----
    const total = questions.length;
    const score = results.reduce((a, r) => a + r.correct, 0);
    const accuracy = Math.round((score / Math.max(1, total)) * 100);

    // per-topic accuracy → weak topics return sooner in revision
    const byTopic = new Map<string, { topicName: string; got: number; total: number }>();
    questions.forEach((q, i) => {
      const r = results[i];
      const key = q.topicId ?? q.topicName;
      const cur = byTopic.get(key) ?? { topicName: q.topicName, got: 0, total: 0 };
      cur.got += r.correct;
      cur.total += 1;
      byTopic.set(key, cur);
    });
    for (const [topicKey, stat] of byTopic) {
      const pct = (stat.got / Math.max(1, stat.total)) * 100;
      if (pct < 60 && topicKey) {
        const topicId = questions.find((q) => (q.topicId ?? q.topicName) === topicKey)?.topicId;
        if (topicId) await ensureRevision(user.id, topicId, true);
      }
    }

    await db.quiz.update({
      where: { id: quiz.id },
      data: {
        completed: true,
        score,
        total,
        accuracy,
        timeSec: Math.max(0, Math.min(7200, body.timeSec ?? 0)),
        answers: JSON.stringify(Object.fromEntries(results.map((r) => [r.id, r]))),
      },
    });

    // streak + feedback notification
    const today = todayStr();
    const all = await db.quiz.findMany({
      where: { userId: user.id, completed: true },
      select: { date: true, accuracy: true, total: true },
    });
    const streak = computeStreak(
      all.filter((q) => q.accuracy !== null && q.total !== null && q.total >= 4 && q.accuracy >= 50).map((q) => q.date),
      today
    );
    if (streak.milestone) {
      await db.notification.create({
        data: {
          userId: user.id,
          type: "streak",
          title: `${streak.milestone}-day streak milestone! 🏅`,
          body: "Your consistency is paying off. Keep it gentle and steady.",
          dedupeKey: `streak-${streak.milestone}`,
        },
      });
    }
    await db.notification.create({
      data: {
        userId: user.id,
        type: "quiz",
        title: `Quiz scored: ${Math.round(score)}/${total} (${accuracy}%)`,
        body:
          accuracy >= 80
            ? "Excellent work! Your plan will keep reinforcing these topics."
            : accuracy >= 50
              ? "Good effort — weaker topics have been queued for revision."
              : "Tough one! Weak topics were added to your Revision Centre sooner.",
      },
    });

    return { score, total, accuracy, results, streak, quizId: quiz.id };
  });
}
