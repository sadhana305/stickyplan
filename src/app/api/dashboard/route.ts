import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { todayStr, addDaysStr, daysBetween } from "@/lib/dates";
import { computeStreak, MILESTONES, STREAK_MESSAGES } from "@/lib/streak";

function qualifying(q: { accuracy: number | null; total: number | null }): boolean {
  return q.accuracy !== null && q.total !== null && q.total >= 4 && q.accuracy >= 50;
}

export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();

    const [planToday, topicsAgg, exams, recentQuizzes, revisionsDue, weekItems, weekQuizzes, notifications] =
      await Promise.all([
        db.planItem.findMany({
          where: { userId: user.id, date: today, OR: [{ approved: true }, { status: "DONE" }] },
          orderBy: { order: "asc" },
        }),
        db.topic.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
        db.exam.findMany({
          where: { userId: user.id, date: { gte: today } },
          orderBy: { date: "asc" },
          take: 5,
          include: { subject: { select: { name: true } } },
        }),
        db.quiz.findMany({
          where: { userId: user.id, completed: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        db.revisionItem.findMany({
          where: { userId: user.id, completed: false, dueDate: { lte: today } },
          orderBy: { dueDate: "asc" },
          take: 6,
          include: { topic: { select: { name: true, subject: { select: { name: true } } } } },
        }),
        db.planItem.findMany({
          where: { userId: user.id, date: { gte: addDaysStr(today, -6), lte: today }, status: "DONE" },
          select: { date: true, minutes: true },
        }),
        db.quiz.findMany({
          where: { userId: user.id, completed: true, date: { gte: addDaysStr(today, -27) } },
          select: { date: true, accuracy: true, total: true },
        }),
        db.notification.findMany({ where: { userId: user.id, read: false }, orderBy: { createdAt: "desc" }, take: 20 }),
      ]);

    // Syllabus completion
    const totalTopics = topicsAgg.reduce((acc, t) => acc + t._count, 0);
    const completedTopics = topicsAgg.find((t) => t.status === "COMPLETED")?._count ?? 0;
    const syllabusPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    // Streak
    const allQuizzes = await db.quiz.findMany({
      where: { userId: user.id, completed: true },
      select: { date: true, accuracy: true, total: true },
    });
    const streak = computeStreak(
      allQuizzes.filter(qualifying).map((q) => q.date),
      today
    );

    // Weekly stats
    const weekly = [] as { date: string; tasks: number; minutes: number }[];
    for (let i = 6; i >= 0; i--) {
      const d = addDaysStr(today, -i);
      const dayItems = weekItems.filter((w) => w.date === d);
      weekly.push({
        date: d,
        tasks: dayItems.length,
        minutes: dayItems.reduce((a, b) => a + b.minutes, 0),
      });
    }
    const quizAccuracyWeekly = weekly.map((w) => {
      const dayQuizzes = weekQuizzes.filter((q) => q.date === w.date && qualifying(q));
      const avg = dayQuizzes.length
        ? Math.round(dayQuizzes.reduce((a, b) => a + (b.accuracy ?? 0), 0) / dayQuizzes.length)
        : null;
      return { ...w, quizzes: dayQuizzes.length, accuracy: avg };
    });

    // Heuristic study suggestions from real data
    const suggestions: string[] = [];
    const pendingTopics = topicsAgg.find((t) => t.status === "PENDING")?._count ?? 0;
    if (exams.length > 0) {
      const nextExam = exams[0];
      const daysLeft = daysBetween(today, nextExam.date);
      if (daysLeft <= 7 && planToday.filter((p) => p.status === "PENDING").length === 0) {
        suggestions.push(
          `Your next exam "${nextExam.title}" is in ${daysLeft} day${daysLeft === 1 ? "" : "s"} but today has no study tasks. Open the Study Planner and generate an intensive plan.`
        );
      }
    }
    if (revisionsDue.length > 0)
      suggestions.push(
        `${revisionsDue.length} revision session${revisionsDue.length > 1 ? "s are" : " is"} due today — quick reviews now beat re-learning later.`
      );
    if (streak.todayDone)
      suggestions.push("Streak secured for today! A short bonus quiz on a weak topic is the perfect cherry on top.");
    if (recentQuizzes.length >= 2) {
      const avg = Math.round(recentQuizzes.reduce((a, q) => a + (q.accuracy ?? 0), 0) / recentQuizzes.length);
      if (avg < 60) suggestions.push(`Your recent quiz average is ${avg}%. Try the AI Tutor on your weakest topics before the next quiz.`);
      else if (avg >= 80) suggestions.push(`You're averaging ${avg}% on recent quizzes — you're on track. Keep the momentum!`);
    }
    if (pendingTopics > 0 && planToday.length === 0)
      suggestions.push(`You have ${pendingTopics} pending topics and no plan for today. Generate a plan in the Study Planner.`);
    if (suggestions.length === 0) suggestions.push("You're all caught up. Explore a new course or ask the AI Tutor something curious today!");

    // Streak message
    const streakMessage = streak.todayDone
      ? STREAK_MESSAGES.todayDone(streak.current)
      : streak.current > 0
        ? STREAK_MESSAGES.alive(streak.current, streak.nextMilestone)
        : recentQuizzes.length === 0
          ? STREAK_MESSAGES.notYet(streak.nextMilestone)
          : STREAK_MESSAGES.missed(streak.longest);

    // Dedupe-friendly notifications for recurring conditions
    const dedupeKeys = new Set(notifications.map((n) => n.dedupeKey));
    const toCreate: { type: string; title: string; body: string; dedupeKey: string }[] = [];
    if (revisionsDue.length > 0 && !dedupeKeys.has(`rev-${today}`)) {
      toCreate.push({
        type: "revision",
        title: `${revisionsDue.length} revision${revisionsDue.length > 1 ? "s" : ""} due today`,
        body: "Spaced repetition works best on schedule — visit the Revision Centre.",
        dedupeKey: `rev-${today}`,
      });
    }
    for (const exam of exams) {
      const d = daysBetween(today, exam.date);
      if (d >= 0 && d <= 7 && !dedupeKeys.has(`exam-${exam.id}`)) {
        toCreate.push({
          type: "exam",
          title: d === 0 ? `"${exam.title}" is today!` : `"${exam.title}" is in ${d} day${d === 1 ? "" : "s"}`,
          body: "Focus plan: prioritise this subject's pending topics today.",
          dedupeKey: `exam-${exam.id}`,
        });
      }
    }
    if (streak.milestone && !dedupeKeys.has(`streak-${streak.milestone}`)) {
      toCreate.push({
        type: "streak",
        title: `${streak.milestone}-day streak milestone! 🏅`,
        body: STREAK_MESSAGES.todayDone(streak.current),
        dedupeKey: `streak-${streak.milestone}`,
      });
    }
    if (toCreate.length > 0) await db.notification.createMany({ data: toCreate.map((n) => ({ ...n, userId: user.id })) });

    const unreadCount = notifications.filter((n) => !n.read).length + toCreate.length;

    return {
      today: {
        date: today,
        items: planToday.map((p) => ({
          id: p.id,
          topicId: p.topicId,
          title: p.topicTitle,
          chapter: p.chapterTitle,
          subject: p.subjectTitle,
          type: p.type,
          minutes: p.minutes,
          status: p.status,
          extra: p.extra,
          approved: p.approved,
        })),
      },
      progress: { totalTopics, completedTopics, syllabusPct, pendingTopics },
      exams: exams.map((e) => ({ id: e.id, title: e.title, date: e.date, subject: e.subject?.name ?? null, daysLeft: daysBetween(today, e.date) })),
      streak,
      streakMessage,
      milestones: MILESTONES,
      recentQuizzes: recentQuizzes.map((q) => ({
        id: q.id,
        date: q.date,
        score: q.score,
        total: q.total,
        accuracy: q.accuracy,
      })),
      revisionsDue: revisionsDue.map((r) => ({
        id: r.id,
        topicTitle: r.topic.name,
        subject: r.topic.subject.name,
        dueDate: r.dueDate,
        weak: r.weak,
      })),
      weekly: quizAccuracyWeekly,
      suggestions,
      unreadNotifications: unreadCount,
    };
  });
}
