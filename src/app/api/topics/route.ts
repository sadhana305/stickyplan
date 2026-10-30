import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { addDaysStr, todayStr } from "@/lib/dates";

const DIFFS = ["EASY", "MEDIUM", "HARD"];

async function ownTopic(userId: string, topicId: string) {
  const topic = await db.topic.findFirst({ where: { id: topicId }, include: { subject: true } });
  if (!topic || topic.subject.userId !== userId) throw new Error("Topic not found.");
  return topic;
}

/** Ensures a spaced-repetition schedule exists for a completed topic. */
export async function ensureRevision(userId: string, topicId: string, weak = false) {
  const target = await db.revisionItem.findFirst({ where: { userId, topicId } });
  if (target) {
    if (weak) {
      await db.revisionItem.update({
        where: { id: target.id },
        data: { weak: true, completed: false, dueDate: addDaysStr(todayStr(), 1) },
      });
    }
    return target;
  }
  return db.revisionItem.create({
    data: { userId, topicId, stage: 0, dueDate: addDaysStr(todayStr(), 1), weak },
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{
    chapterId?: string;
    name?: string;
    difficulty?: string;
    estMinutes?: number;
    subtopics?: string[];
  }>(req);
  return withUser(async (user) => {
    const name = (body.name ?? "").trim();
    if (!body.chapterId || !name) throw new Error("Topic needs a chapter and a name.");
    const chapter = await db.chapter.findFirst({ where: { id: body.chapterId }, include: { subject: true } });
    if (!chapter || chapter.subject.userId !== user.id) throw new Error("Chapter not found.");
    const difficulty = DIFFS.includes(body.difficulty ?? "") ? body.difficulty! : "MEDIUM";
    const topic = await db.topic.create({
      data: {
        userId: user.id,
        subjectId: chapter.subject.id,
        chapterId: chapter.id,
        name,
        difficulty,
        estMinutes: Math.max(15, Math.min(180, body.estMinutes ?? (difficulty === "HARD" ? 75 : difficulty === "EASY" ? 30 : 50))),
        subtopics: JSON.stringify((body.subtopics ?? []).map((s) => s.trim()).filter(Boolean)),
      },
    });
    return { topic };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{
    id?: string;
    name?: string;
    difficulty?: string;
    importance?: number;
    status?: string;
    estMinutes?: number;
    subtopics?: string[];
  }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing topic id.");
    const topic = await ownTopic(user.id, body.id);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) throw new Error("Topic name cannot be empty.");
      data.name = body.name.trim();
    }
    if (body.difficulty && DIFFS.includes(body.difficulty)) data.difficulty = body.difficulty;
    if (typeof body.importance === "number") data.importance = Math.max(1, Math.min(5, body.importance));
    if (body.estMinutes !== undefined) data.estMinutes = Math.max(15, Math.min(180, body.estMinutes));
    if (body.subtopics !== undefined) data.subtopics = JSON.stringify(body.subtopics.map((s) => s.trim()).filter(Boolean));
    if (body.status && ["PENDING", "COMPLETED", "SKIPPED"].includes(body.status)) {
      data.status = body.status;
      data.completedAt = body.status === "COMPLETED" ? new Date() : null;
      if (body.status === "COMPLETED") {
        await ensureRevision(user.id, topic.id);
      }
    }
    const updated = await db.topic.update({ where: { id: topic.id }, data });
    return { topic: updated };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    const topic = await ownTopic(user.id, id);
    await db.topic.delete({ where: { id: topic.id } });
    return { ok: true };
  });
}
