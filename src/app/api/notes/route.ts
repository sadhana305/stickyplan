import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const bookmarked = new URL(req.url).searchParams.get("bookmarked");
  return withUser(async (user) => {
    const notes = await db.note.findMany({
      where: { userId: user.id, ...(bookmarked === "1" ? { bookmarked: true } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    return { notes };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ title?: string; content?: string; topicId?: string; topicTitle?: string }>(req);
  return withUser(async (user) => {
    const title = (body.title ?? "").trim() || "Untitled note";
    const content = body.content ?? "";
    if (!content.trim()) throw new Error("Note content cannot be empty.");
    const note = await db.note.create({
      data: {
        userId: user.id,
        title,
        content,
        topicId: body.topicId ?? null,
        topicTitle: body.topicTitle ?? null,
      },
    });
    return { note };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{ id?: string; title?: string; content?: string; bookmarked?: boolean }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing note id.");
    const existing = await db.note.findFirst({ where: { id: body.id, userId: user.id } });
    if (!existing) throw new Error("Note not found.");
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim() || "Untitled note";
    if (body.content !== undefined) data.content = body.content;
    if (body.bookmarked !== undefined) data.bookmarked = body.bookmarked;
    const note = await db.note.update({ where: { id: existing.id }, data });
    return { note };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    await db.note.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
