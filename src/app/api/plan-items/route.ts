import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { parseWeekdayLimits } from "@/lib/planner";
import { addDaysStr, todayStr, weekdayOf, daysBetween } from "@/lib/dates";
import { ensureRevision } from "@/app/api/topics/route";

export async function PATCH(req: Request) {
  const body = await parseBody<{
    id?: string;
    status?: "DONE" | "SKIPPED" | "POSTPONED" | "PENDING";
    approved?: boolean;
  }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing item id.");
    const item = await db.planItem.findFirst({ where: { id: body.id, userId: user.id } });
    if (!item) throw new Error("Plan item not found.");

    if (typeof body.approved === "boolean") {
      await db.planItem.update({ where: { id: item.id }, data: { approved: body.approved } });
      return { ok: true };
    }

    if (body.status === "DONE") {
      await db.planItem.update({ where: { id: item.id }, data: { status: "DONE" } });
      if (item.topicId) {
        const topic = await db.topic.findFirst({ where: { id: item.topicId, userId: user.id } });
        if (topic && topic.status !== "COMPLETED") {
          await db.topic.update({
            where: { id: topic.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
          await ensureRevision(user.id, topic.id);
        }
      }
      return { ok: true };
    }

    if (body.status === "SKIPPED") {
      await db.planItem.update({ where: { id: item.id }, data: { status: "SKIPPED" } });
      return { ok: true };
    }

    if (body.status === "POSTPONED") {
      // Move to the next available study day
      const limits = parseWeekdayLimits(user.weekdayLimits);
      const studyDays = new Set(
        user.studyDays.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
      );
      const today = todayStr();
      let nextDate = item.date <= today ? addDaysStr(today, 1) : addDaysStr(item.date, 1);
      for (let i = 0; i < 30; i++) {
        const wd = weekdayOf(nextDate);
        if (studyDays.has(wd) && (limits[wd] ?? 0) > 0) break;
        nextDate = addDaysStr(nextDate, 1);
      }
      await db.planItem.update({
        where: { id: item.id },
        data: { date: nextDate, status: "PENDING" },
      });
      return { ok: true, movedTo: nextDate };
    }

    if (body.status === "PENDING") {
      await db.planItem.update({ where: { id: item.id }, data: { status: "PENDING" } });
      return { ok: true };
    }

    throw new Error("Unknown status.");
  });
}

export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const items = await db.planItem.findMany({
      where: { userId: user.id, date: { gte: today } },
      orderBy: [{ date: "asc" }, { order: "asc" }],
      include: { topic: { select: { status: true } } },
    });
    const doneTopicIds = new Set(
      items.filter((i) => i.status === "DONE" && i.topicId).map((i) => i.topicId!)
    );
    return {
      items: items
        .filter((i) => !(doneTopicIds.has(i.topicId ?? "") && i.status !== "DONE"))
        .map((i) => ({
          ...i,
          daysFromToday: daysBetween(today, i.date),
          weekday: weekdayOf(i.date),
        })),
    };
  });
}
