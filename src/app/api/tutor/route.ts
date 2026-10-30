import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chat } from "@/lib/ai";
import { todayStr } from "@/lib/dates";

export const maxDuration = 120;

export async function GET() {
  return withUser(async (user) => {
    const messages = await db.tutorMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 60,
    });
    return { messages };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ message?: string; clear?: boolean }>(req);
  return withUser(async (user) => {
    if (body.clear) {
      await db.tutorMessage.deleteMany({ where: { userId: user.id } });
      return { ok: true, cleared: true };
    }
    const message = (body.message ?? "").trim();
    if (!message) throw new Error("Type a message for your tutor.");

    // Build syllabus/progress context
    const [subjects, weakTopics, recentQuizzes] = await Promise.all([
      db.subject.findMany({ where: { userId: user.id }, include: { topics: { select: { name: true, status: true, difficulty: true }, take: 12 } } }),
      db.revisionItem.findMany({
        where: { userId: user.id, weak: true, completed: false },
        include: { topic: { select: { name: true } } },
        take: 6,
      }),
      db.quiz.findMany({ where: { userId: user.id, completed: true }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

    const syllabusCtx = subjects.length
      ? subjects
          .map((s) => `${s.name}: ${s.topics.map((t) => `${t.name} (${t.status.toLowerCase()}, ${t.difficulty.toLowerCase()})`).join("; ")}`)
          .join("\n")
      : "No syllabus added yet.";
    const weakCtx = weakTopics.length
      ? weakTopics.map((w) => w.topic.name).join("; ")
      : "none flagged yet";
    const avg = recentQuizzes.length
      ? Math.round(recentQuizzes.reduce((a, q) => a + (q.accuracy ?? 0), 0) / recentQuizzes.length)
      : null;

    const system = `You are the STICKY PLAN AI Tutor — a warm, patient, step-by-step tutor for a student.
Student: ${user.name} (${user.educationLevel ?? "student"}, ${[user.course, user.semester].filter(Boolean).join(", ") || "course unknown"}).
Their syllabus (topic: status, difficulty):\n${syllabusCtx}
Topics needing revision (quiz accuracy < 60%): ${weakCtx}.
Recent quiz average: ${avg !== null ? `${avg}%` : "no quizzes yet"}.
Learning preferences: ${user.learningPrefs ?? "not specified"}.
Guidelines: explain step by step, use simple language with concrete examples, encourage the student, check understanding with a small question at the end of longer explanations. Use markdown. If asked something unrelated to studying, gently steer back to learning topics.`;

    const history = await db.tutorMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const convo = history
      .reverse()
      .map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: m.content }));

    const reply = await chat(
      [
        { role: "assistant", content: system },
        ...convo,
        { role: "user", content: message },
      ],
      "tutor"
    );

    await db.tutorMessage.create({ data: { userId: user.id, role: "user", content: message } });
    await db.tutorMessage.create({ data: { userId: user.id, role: "assistant", content: reply } });

    return { reply, date: todayStr() };
  });
}
