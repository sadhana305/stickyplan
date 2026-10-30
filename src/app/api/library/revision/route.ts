import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { todayStr, addDaysStr, daysBetween } from "@/lib/dates";

export const runtime = "nodejs";

const INTERVALS = [1, 3, 7, 14, 30]; // same spaced-repetition ladder as the Revision Centre
const WEAK_INTERVALS = [1, 2, 4, 8, 15];

export async function GET() {
  return withUser(async (user) => {
    const today = todayStr();
    const items = await db.libraryRevision.findMany({
      where: { userId: user.id },
      orderBy: { dueDate: "asc" },
    });
    const mapped = items.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      docId: r.docId,
      questionId: r.questionId,
      stage: r.stage,
      totalStages: 5,
      dueDate: r.dueDate,
      overdue: r.dueDate < today,
      dueToday: r.dueDate === today,
      daysAway: daysBetween(today, r.dueDate),
      weak: r.weak,
      completed: r.completed,
      intervals: r.weak ? WEAK_INTERVALS : INTERVALS,
    }));
    return {
      due: mapped.filter((m) => !m.completed && m.dueDate <= today),
      upcoming: mapped.filter((m) => !m.completed && m.dueDate > today).slice(0, 20),
      completedCount: mapped.filter((m) => m.completed).length,
    };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{
    action?: "create" | "revised" | "again" | "remove";
    id?: string;
    title?: string;
    subtitle?: string;
    docId?: string;
    questionId?: string;
  }>(req);
  return withUser(async (user) => {
    const action = body.action ?? "create";

    if (action === "create") {
      const title = (body.title ?? "").trim();
      if (!title) throw new Error("Nothing selected to schedule.");
      let subtitle = (body.subtitle ?? "").slice(0, 160);
      let docId: string | null = null;
      let questionId: string | null = null;

      if (body.docId) {
        const doc = await db.libraryDoc.findFirst({ where: { id: body.docId, userId: user.id } });
        if (!doc) throw new Error("Document not found.");
        docId = doc.id;
        if (!subtitle) subtitle = doc.subjectName || "My Study Library";
      }
      if (body.questionId) {
        const q = await db.qbQuestion.findFirst({ where: { id: body.questionId, userId: user.id } });
        if (!q) throw new Error("Question not found.");
        questionId = q.id;
        docId = q.docId ?? null;
        if (!subtitle) subtitle = q.subjectName || "My Q&A Bank";
      }

      const existing = await db.libraryRevision.findFirst({
        where: { userId: user.id, title, completed: false },
      });
      if (existing) return { ok: true, duplicate: true, message: "Already in your revision schedule." };

      const item = await db.libraryRevision.create({
        data: {
          userId: user.id,
          title: title.slice(0, 160),
          subtitle,
          docId,
          questionId,
          dueDate: todayStr(), // first review is due tomorrow via the 1-day ladder step
        },
      });
      return { ok: true, item, message: "Added to your revision schedule (1 · 3 · 7 · 14 · 30 days)." };
    }

    if (action === "revised" || action === "again" || action === "remove") {
      if (!body.id) throw new Error("Missing revision item.");
      const item = await db.libraryRevision.findFirst({ where: { id: body.id, userId: user.id } });
      if (!item) throw new Error("Revision item not found.");

      if (action === "remove") {
        await db.libraryRevision.delete({ where: { id: item.id } });
        return { ok: true, removed: true };
      }

      const intervals = item.weak ? WEAK_INTERVALS : INTERVALS;
      const today = todayStr();
      if (action === "again") {
        await db.libraryRevision.update({ where: { id: item.id }, data: { dueDate: addDaysStr(today, 1), weak: true } });
        return { ok: true, nextDue: addDaysStr(today, 1) };
      }
      const nextStage = item.stage + 1;
      if (nextStage >= intervals.length) {
        await db.libraryRevision.update({ where: { id: item.id }, data: { completed: true, stage: intervals.length } });
        return { ok: true, completed: true };
      }
      const nextDue = addDaysStr(today, intervals[nextStage]);
      await db.libraryRevision.update({ where: { id: item.id }, data: { stage: nextStage, dueDate: nextDue } });
      return { ok: true, stage: nextStage, nextDue };
    }

    throw new Error("Unknown action.");
  });
}
