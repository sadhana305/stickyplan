import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { generatePlan, type PlannerTopic, type PlannerExam } from "@/lib/planner";
import { todayStr } from "@/lib/dates";

export async function POST(req: Request) {
  const body = await parseBody<{ mode?: string }>(req);
  return withUser(async (user) => {
    const mode = body.mode && ["FIXED", "FLEXIBLE", "BALANCED"].includes(body.mode) ? body.mode : user.planningMode;

    const topicsRaw = await db.topic.findMany({
      where: { userId: user.id, status: "PENDING" },
      include: { subject: { select: { name: true } }, chapter: { select: { name: true } } },
    });
    const exams = await db.exam.findMany({ where: { userId: user.id } });

    const topics: PlannerTopic[] = topicsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      subjectId: t.subjectId,
      subjectName: t.subject.name,
      chapterName: t.chapter.name,
      difficulty: t.difficulty,
      importance: t.importance,
      estMinutes: t.estMinutes,
    }));
    const plannerExams: PlannerExam[] = exams.map((e) => ({
      subjectId: e.subjectId,
      title: e.title,
      date: e.date,
    }));

    const today = todayStr();
    // Reschedule: clear still-pending items from today onwards (DONE history is kept,
    // and topics that were pending simply flow back into the new plan).
    await db.planItem.deleteMany({
      where: { userId: user.id, status: "PENDING", date: { gte: today } },
    });
    // Overdue pending items also return to the queue
    await db.planItem.deleteMany({
      where: { userId: user.id, status: "PENDING", date: { lt: today } },
    });

    const result = generatePlan(
      {
        studyHoursPerDay: user.studyHoursPerDay,
        studyDays: user.studyDays,
        weekdayLimits: user.weekdayLimits,
        dailyTopicLimit: user.dailyTopicLimit,
        planningMode: mode,
      },
      topics,
      plannerExams,
      mode,
      today
    );

    if (result.items.length > 0) {
      await db.planItem.createMany({
        data: result.items.map((it, i) => ({
          userId: user.id,
          topicId: it.topicId,
          date: it.date,
          type: it.type,
          minutes: it.minutes,
          order: i,
          extra: it.extra,
          approved: it.approved,
          topicTitle: it.topicTitle,
          chapterTitle: it.chapterTitle,
          subjectTitle: it.subjectTitle,
        })),
      });
    }

    await db.user.update({ where: { id: user.id }, data: { planningMode: mode } });
    if (result.items.length > 0) {
      await db.notification.create({
        data: {
          userId: user.id,
          type: "plan_ready",
          title: "Your study plan is ready 📅",
          body: `${result.items.length} study sessions scheduled${result.warnings.length > 0 ? " — check the planner notes." : ""}`,
          dedupeKey: `plan-${today}`,
        },
      });
    }

    return {
      ok: true,
      scheduled: result.items.filter((i) => !i.extra).length,
      suggestions: result.items.filter((i) => i.extra).length,
      warnings: result.warnings,
      mode,
    };
  });
}
