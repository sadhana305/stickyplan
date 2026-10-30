import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { todayStr, addDaysStr } from "@/lib/dates";

export const runtime = "nodejs";

type PlanAdd = {
  title: string;
  subjectTitle?: string;
  chapterTitle?: string;
  date?: string; // YYYY-MM-DD
  type?: "LEARN" | "REVISE";
  minutes?: number;
};

/**
 * Adds the student's selected library materials/questions to their EXISTING
 * study planner as extra sessions. Nothing here touches or re-generates the
 * current plan — items are only ever appended on the chosen date.
 */
export async function POST(req: Request) {
  const body = await parseBody<{ docId?: string; questionIds?: string[]; items?: PlanAdd[] }>(req);
  return withUser(async (user) => {
    const items: PlanAdd[] = [];

    if (body.docId) {
      const doc = await db.libraryDoc.findFirst({ where: { id: body.docId, userId: user.id } });
      if (!doc) throw new Error("Document not found.");
      items.push({
        title: `Study: ${doc.name}`,
        subjectTitle: doc.subjectName || "My Library",
        chapterTitle: doc.chapterName || undefined,
      });
    }

    const qIds = (body.questionIds ?? []).slice(0, 30);
    if (qIds.length > 0) {
      const questions = await db.qbQuestion.findMany({ where: { id: { in: qIds }, userId: user.id } });
      for (const q of questions) {
        items.push({
          title: `Practise: ${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}`,
          subjectTitle: q.subjectName || "My Q&A Bank",
          chapterTitle: q.chapterName || undefined,
          type: "REVISE",
        });
      }
    }

    for (const raw of body.items ?? []) {
      if (raw && typeof raw.title === "string" && raw.title.trim()) items.push(raw);
    }

    if (items.length === 0) throw new Error("Nothing selected to add to the planner.");

    const rows = items.slice(0, 40).map((item) => ({
      userId: user.id,
      topicId: null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? "") ? item.date! : addDaysStr(todayStr(), 1),
      type: item.type === "REVISE" ? "REVISE" : "LEARN",
      minutes: Math.max(10, Math.min(240, typeof item.minutes === "number" ? Math.round(item.minutes) : 30)),
      order: 0,
      topicTitle: item.title.trim().slice(0, 160),
      chapterTitle: item.chapterTitle?.slice(0, 120) ?? null,
      subjectTitle: item.subjectTitle?.slice(0, 120) ?? null,
    }));

    const result = await db.planItem.createMany({ data: rows });
    return { added: result.count, message: `Added ${result.count} session${result.count > 1 ? "s" : ""} to your planner.` };
  });
}
