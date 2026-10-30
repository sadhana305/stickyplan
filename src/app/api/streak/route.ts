import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { todayStr, addDaysStr } from "@/lib/dates";
import { computeStreak, MILESTONES, STREAK_MESSAGES } from "@/lib/streak";

/** A quiz qualifies for the streak when it has ≥4 questions and ≥50% accuracy. */
export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const quizzes = await db.quiz.findMany({
      where: { userId: user.id, completed: true },
      select: { date: true, accuracy: true, total: true },
    });
    const qualifying = quizzes
      .filter((q) => q.accuracy !== null && q.total !== null && q.total >= 4 && q.accuracy >= 50)
      .map((q) => q.date);
    const streak = computeStreak(qualifying, today);

    // 12-week calendar of quiz days
    const calendar: { date: string; done: boolean; qualifying: boolean }[] = [];
    const anyDay = new Set(quizzes.map((q) => q.date));
    for (let i = 83; i >= 0; i--) {
      const d = addDaysStr(today, -i);
      calendar.push({ date: d, done: anyDay.has(d), qualifying: qualifying.includes(d) });
    }

    const message = streak.todayDone
      ? STREAK_MESSAGES.todayDone(streak.current)
      : streak.current > 0
        ? STREAK_MESSAGES.alive(streak.current, streak.nextMilestone)
        : anyDay.size === 0
          ? STREAK_MESSAGES.notYet(streak.nextMilestone)
          : STREAK_MESSAGES.missed(streak.longest);

    return {
      current: streak.current,
      longest: streak.longest,
      todayDone: streak.todayDone,
      nextMilestone: streak.nextMilestone,
      milestones: MILESTONES,
      totalQuizDays: new Set(qualifying).size,
      totalQuizzes: quizzes.length,
      calendar,
      message,
    };
  });
}
