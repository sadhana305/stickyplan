import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { chat } from "@/lib/ai";
import { todayStr, addDaysStr, daysBetween } from "@/lib/dates";

export const maxDuration = 120;

/** A genuinely AI-generated study suggestion based on the student's real data. */
export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const [topicsAgg, exams, recentQuizzes, revisionsDue, todayItems] = await Promise.all([
      db.topic.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
      db.exam.findMany({ where: { userId: user.id, date: { gte: today } }, orderBy: { date: "asc" }, take: 3 }),
      db.quiz.findMany({ where: { userId: user.id, completed: true }, orderBy: { createdAt: "desc" }, take: 5, select: { accuracy: true } }),
      db.revisionItem.count({ where: { userId: user.id, completed: false, dueDate: { lte: today } } }),
      db.planItem.findMany({ where: { userId: user.id, date: today }, select: { status: true, topicTitle: true, minutes: true } }),
    ]);

    const totalTopics = topicsAgg.reduce((a, t) => a + t._count, 0);
    const completed = topicsAgg.find((t) => t.status === "COMPLETED")?._count ?? 0;
    const pending = topicsAgg.find((t) => t.status === "PENDING")?._count ?? 0;
    const avgAccuracy = recentQuizzes.length
      ? Math.round(recentQuizzes.reduce((a, q) => a + (q.accuracy ?? 0), 0) / recentQuizzes.length)
      : null;

    const stats = `Student: ${user.name} (${user.educationLevel ?? "student"}${user.course ? `, ${user.course}` : ""}${user.semester ? `, ${user.semester}` : ""}).
Today is ${new Date().toLocaleDateString("en-US", { weekday: "long" })}.
Syllabus: ${completed}/${totalTopics} topics completed, ${pending} pending (${totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0}% done).
Today's plan: ${todayItems.filter((i) => i.status === "PENDING").length} tasks pending, ${todayItems.filter((i) => i.status === "DONE").length} done.
Topics on today's plan: ${todayItems.map((i) => i.topicTitle).join(", ") || "none"}.
Exams: ${exams.map((e) => `${e.title} in ${daysBetween(today, e.date)} day(s)`).join("; ") || "none scheduled"}.
Recent quiz average: ${avgAccuracy !== null ? `${avgAccuracy}%` : "no quizzes yet"}.
Revisions due today: ${revisionsDue}.
Daily topic limit: ${user.dailyTopicLimit}. Study hours: ${user.studyHoursPerDay}. Planning mode: ${user.planningMode}.`;

    const suggestion = await chat(
      [
        {
          role: "assistant",
          content:
            "You are a kind, practical study coach. Based ONLY on the student's data below, give ONE specific, actionable suggestion for today (2-3 sentences, warm and encouraging, no bullet lists, no markdown headings). Reference concrete topics, exams or numbers from the data. Never invent facts.",
        },
        { role: "user", content: stats },
      ],
      "suggestion"
    );

    return { suggestion };
  });
}
