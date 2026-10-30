import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { todayStr, addDaysStr, daysBetween } from "@/lib/dates";

const NORMAL_INTERVALS = [1, 3, 7, 14, 30];
const WEAK_INTERVALS = [1, 2, 4, 8, 15]; // weak topics return sooner

export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const items = await db.revisionItem.findMany({
      where: { userId: user.id },
      include: { topic: { select: { name: true, status: true, subject: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    });
    const mapped = items.map((r) => ({
      id: r.id,
      topicId: r.topicId,
      topicTitle: r.topic.name,
      subject: r.topic.subject.name,
      topicStatus: r.topic.status,
      stage: r.stage,
      totalStages: 5,
      dueDate: r.dueDate,
      overdue: r.dueDate < today,
      dueToday: r.dueDate === today,
      daysAway: daysBetween(today, r.dueDate),
      weak: r.weak,
      completed: r.completed,
      intervals: r.weak ? WEAK_INTERVALS : NORMAL_INTERVALS,
    }));
    return {
      due: mapped.filter((m) => !m.completed && m.dueDate <= today),
      upcoming: mapped.filter((m) => !m.completed && m.dueDate > today).slice(0, 20),
      completedCount: mapped.filter((m) => m.completed).length,
    };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ id?: string; action?: "revised" | "again" }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing revision item.");
    const item = await db.revisionItem.findFirst({ where: { id: body.id, userId: user.id } });
    if (!item) throw new Error("Revision item not found.");

    const intervals = item.weak ? WEAK_INTERVALS : NORMAL_INTERVALS;
    const nextStage = item.stage + 1;
    const today = todayStr();

    if (body.action === "again") {
      // Student felt shaky → repeat same stage soon
      await db.revisionItem.update({
        where: { id: item.id },
        data: { dueDate: addDaysStr(today, 1), weak: true },
      });
      return { ok: true, nextDue: addDaysStr(today, 1) };
    }

    if (nextStage >= intervals.length) {
      await db.revisionItem.update({
        where: { id: item.id },
        data: { completed: true, stage: intervals.length },
      });
      return { ok: true, completed: true };
    }

    const nextDue = addDaysStr(today, intervals[nextStage]);
    await db.revisionItem.update({
      where: { id: item.id },
      data: { stage: nextStage, dueDate: nextDue },
    });
    return { ok: true, stage: nextStage, nextDue };
  });
}
