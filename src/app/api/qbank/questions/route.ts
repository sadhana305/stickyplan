import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export const runtime = "nodejs";

export type QbInput = {
  question?: string;
  marks?: number;
  type?: string;
  options?: string[];
  answer?: string | null;
  answerSource?: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  examName?: string;
  docId?: string | null;
  docTitle?: string | null;
};

const QB_TYPES = new Set(["MCQ", "TRUE_FALSE", "FILL_BLANK", "MATCH", "VERY_SHORT", "SHORT", "LONG", "DESCRIPTIVE", "NUMERICAL", "APPLICATION"]);

function cleanType(t?: string): string {
  return t && QB_TYPES.has(t) ? t : "SHORT";
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const subject = sp.get("subject");
  const chapter = sp.get("chapter");
  const topic = sp.get("topic");
  const marks = sp.get("marks");
  const status = sp.get("status");
  const bookmarked = sp.get("bookmarked");
  const docId = sp.get("docId");
  const ids = sp.get("ids");
  const unanswered = sp.get("unanswered");

  return withUser(async (user) => {
    const where: Record<string, unknown> = { userId: user.id };
    if (subject && subject !== "all") where.subjectName = subject;
    if (chapter && chapter !== "all") where.chapterName = chapter;
    if (topic && topic !== "all") where.topicName = topic;
    if (marks && marks !== "all") where.marks = Number(marks);
    if (status && status !== "all") where.status = status;
    if (bookmarked === "1") where.bookmarked = true;
    if (docId) where.docId = docId;
    if (unanswered === "1") where.answer = null;
    if (ids) {
      const list = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 60);
      where.id = { in: list };
    }
    if (q) {
      (where as { OR?: unknown }).OR = [
        { question: { contains: q } },
        { answer: { contains: q } },
        { subjectName: { contains: q } },
        { chapterName: { contains: q } },
        { topicName: { contains: q } },
        { examName: { contains: q } },
      ];
    }
    const questions = await db.qbQuestion.findMany({ where, orderBy: [{ marks: "asc" }, { createdAt: "desc" }] });
    return { questions };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ items?: QbInput[] } & QbInput>(req);
  return withUser(async (user) => {
    const items = body.items ?? [body];
    const cleaned = items
      .filter((i) => i && typeof i.question === "string" && i.question.trim())
      .slice(0, 60)
      .map((i) => ({
        userId: user.id,
        marks: Math.max(1, Math.min(25, Math.round(Number(i.marks) || 2))),
        type: cleanType(i.type),
        question: i.question!.trim().slice(0, 2000),
        options: Array.isArray(i.options) && i.options.length >= 2 ? JSON.stringify(i.options.slice(0, 6).map((o) => String(o).slice(0, 300))) : null,
        answer: typeof i.answer === "string" && i.answer.trim() ? i.answer.trim().slice(0, 6000) : null,
        answerSource: typeof i.answer === "string" && i.answer.trim() ? (i.answerSource === "ai" ? "ai" : "original") : "none",
        subjectName: (i.subjectName ?? "").slice(0, 120),
        chapterName: (i.chapterName ?? "").slice(0, 120),
        topicName: (i.topicName ?? "").slice(0, 120),
        examName: (i.examName ?? "").slice(0, 120),
        docId: i.docId ?? null,
        docTitle: (i.docTitle ?? "").slice(0, 180) || null,
      }));
    if (cleaned.length === 0) throw new Error("Write a question first.");

    // verify doc ownership
    const uniqueDocIds = [...new Set(cleaned.map((c) => c.docId).filter(Boolean))] as string[];
    for (const docId of uniqueDocIds) {
      const doc = await db.libraryDoc.findFirst({ where: { id: docId, userId: user.id }, select: { id: true } });
      if (!doc) {
        for (const c of cleaned) if (c.docId === docId) { c.docId = null; c.docTitle = null; }
      }
    }

    const result = await db.qbQuestion.createMany({ data: cleaned });
    const total = await db.qbQuestion.count({ where: { userId: user.id } });
    return { added: result.count, total, message: `Saved ${result.count} question${result.count > 1 ? "s" : ""} to your bank.` };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<Record<string, unknown>>(req);
  return withUser(async (user) => {
    const id = String(body.id ?? "");
    if (!id) throw new Error("Missing question id.");
    const existing = await db.qbQuestion.findFirst({ where: { id, userId: user.id } });
    if (!existing) throw new Error("Question not found.");

    const data: Record<string, unknown> = {};
    if (typeof body.question === "string" && body.question.trim()) data.question = body.question.trim().slice(0, 2000);
    if (typeof body.marks === "number") data.marks = Math.max(1, Math.min(25, Math.round(body.marks)));
    if (typeof body.type === "string" && QB_TYPES.has(body.type)) data.type = body.type;
    if (Array.isArray(body.options)) data.options = body.options.length >= 2 ? JSON.stringify(body.options.slice(0, 6).map((o) => String(o).slice(0, 300))) : null;
    for (const k of ["subjectName", "chapterName", "topicName", "examName"] as const) {
      if (typeof body[k] === "string") data[k] = (body[k] as string).slice(0, 120);
    }
    if (typeof body.bookmarked === "boolean") data.bookmarked = body.bookmarked;
    if (typeof body.status === "string" && ["NOT_STARTED", "LEARNING", "COMPLETED", "NEEDS_REVISION"].includes(body.status)) {
      data.status = body.status;
    }
    if ("answer" in body) {
      const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 6000) : "";
      if (answer) {
        data.answer = answer;
        // a human-edited/typed answer is the student's own — mark it original unless explicitly AI
        data.answerSource = body.answerSource === "ai" ? "ai" : "original";
      } else {
        data.answer = null;
        data.answerSource = "none";
      }
    }
    if ("aiAnswer" in body) {
      data.aiAnswer = typeof body.aiAnswer === "string" && body.aiAnswer.trim() ? body.aiAnswer.trim().slice(0, 6000) : null;
    }

    const updated = await db.qbQuestion.update({ where: { id: existing.id }, data });
    return { question: updated };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    await db.qbQuestion.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
