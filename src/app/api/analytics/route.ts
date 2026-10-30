import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { todayStr, addDaysStr } from "@/lib/dates";

export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const [subjects, quizzes, planDone, revisions, materials] = await Promise.all([
      db.subject.findMany({
        where: { userId: user.id },
        include: { topics: { select: { status: true, difficulty: true, name: true } } },
      }),
      db.quiz.findMany({
        where: { userId: user.id, completed: true },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, date: true, score: true, total: true, accuracy: true, answers: true },
      }),
      db.planItem.findMany({
        where: { userId: user.id, status: "DONE", date: { gte: addDaysStr(today, -29) } },
        select: { date: true, minutes: true },
      }),
      db.revisionItem.findMany({
        where: { userId: user.id },
        select: { completed: true, dueDate: true, stage: true },
      }),
      db.studyMaterial.count({ where: { userId: user.id } }),
    ]);

    // Subject-wise progress
    const subjectProgress = subjects.map((s) => {
      const total = s.topics.length;
      const completed = s.topics.filter((t) => t.status === "COMPLETED").length;
      return {
        subject: s.name,
        total,
        completed,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    // Quiz accuracy trend
    const accuracyTrend = quizzes.map((q) => ({
      date: q.date,
      accuracy: q.accuracy ?? 0,
      score: q.score ?? 0,
      total: q.total ?? 0,
    }));

    // Weekly activity (last 7 days)
    const weekly: { date: string; tasks: number; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysStr(today, -i);
      const dayItems = planDone.filter((p) => p.date === d);
      weekly.push({
        date: d,
        tasks: dayItems.length,
        minutes: dayItems.reduce((a, b) => a + b.minutes, 0),
      });
    }

    // Strong / weak topics from graded answers
    const topicStats = new Map<string, { name: string; got: number; count: number }>();
    for (const q of quizzes) {
      try {
        const answers = JSON.parse(q.answers) as Record<string, { topicName?: string; correct?: number }>;
        for (const a of Object.values(answers)) {
          if (!a.topicName) continue;
          const cur = topicStats.get(a.topicName) ?? { name: a.topicName, got: 0, count: 0 };
          cur.got += a.correct ?? 0;
          cur.count += 1;
          topicStats.set(a.topicName, cur);
        }
      } catch {
        /* ignore malformed */
      }
    }
    const topicPerf = [...topicStats.values()]
      .map((t) => ({ topic: t.name, accuracy: Math.round((t.got / t.count) * 100), attempts: t.count }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const totalMinutes = planDone.reduce((a, b) => a + b.minutes, 0);
    const avgAccuracy = quizzes.length
      ? Math.round(quizzes.reduce((a, q) => a + (q.accuracy ?? 0), 0) / quizzes.length)
      : null;

    const recommendations: string[] = [];
    const weak = topicPerf.filter((t) => t.accuracy < 60).slice(0, 3);
    if (weak.length > 0)
      recommendations.push(
        `${weak.map((w) => `"${w.topic}"`).join(", ")} ${weak.length === 1 ? "is" : "are"} scoring below 60% — ask the AI Tutor to explain ${weak.length === 1 ? "it" : "them"} again, then redo a quiz on ${weak.length === 1 ? "that topic" : "those topics"}.`
      );
    const lagging = subjectProgress.filter((s) => s.total > 0 && s.pct < 30).slice(0, 2);
    if (lagging.length > 0)
      recommendations.push(
        `${lagging.map((l) => `"${l.subject}"`).join(" and ")} ${lagging.length === 1 ? "is" : "are"} still under 30% complete — consider giving ${lagging.length === 1 ? "it" : "them"} an extra study day each week.`
      );
    if (avgAccuracy !== null && avgAccuracy >= 75)
      recommendations.push(`Quiz average is ${avgAccuracy}% — strong work! Slightly harder topics (mark them "Hard" in the syllabus) will stretch you further.`);
    const overdue = revisions.filter((r) => !r.completed && r.dueDate < today).length;
    if (overdue > 0)
      recommendations.push(`${overdue} revision session${overdue === 1 ? "" : "s"} overdue — clearing them first keeps the spaced-repetition ladder effective.`);
    if (recommendations.length === 0)
      recommendations.push("Your fundamentals look healthy. Keep the streak going and gradually raise topic difficulty.");

    return {
      subjectProgress,
      accuracyTrend,
      weekly,
      strongTopics: topicPerf.filter((t) => t.accuracy >= 75).slice(0, 6),
      weakTopics: topicPerf.filter((t) => t.accuracy < 60).slice(-6).reverse(),
      totals: {
        studyMinutes: totalMinutes,
        topicsCompleted: subjects.reduce((a, s) => a + s.topics.filter((t) => t.status === "COMPLETED").length, 0),
        quizzes: quizzes.length,
        avgAccuracy,
        revisionsCompleted: revisions.filter((r) => r.completed).length,
        materialsGenerated: materials,
      },
      recommendations,
    };
  });
}
