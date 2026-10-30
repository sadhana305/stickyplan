import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const body = await parseBody<{ subjectId?: string; name?: string }>(req);
  return withUser(async (user) => {
    const name = (body.name ?? "").trim();
    if (!body.subjectId || !name) throw new Error("Chapter needs a subject and a name.");
    const subject = await db.subject.findFirst({ where: { id: body.subjectId, userId: user.id } });
    if (!subject) throw new Error("Subject not found.");
    const count = await db.chapter.count({ where: { subjectId: subject.id } });
    const chapter = await db.chapter.create({
      data: { subjectId: subject.id, name, order: count },
    });
    return { chapter };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{ id?: string; name?: string }>(req);
  return withUser(async (user) => {
    if (!body.id || !body.name?.trim()) throw new Error("Chapter name cannot be empty.");
    const chapter = await db.chapter.findFirst({ where: { id: body.id }, include: { subject: true } });
    if (!chapter || chapter.subject.userId !== user.id) throw new Error("Chapter not found.");
    await db.chapter.update({ where: { id: body.id }, data: { name: body.name.trim() } });
    return { ok: true };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    const chapter = await db.chapter.findFirst({ where: { id }, include: { subject: true } });
    if (!chapter || chapter.subject.userId !== user.id) throw new Error("Chapter not found.");
    await db.chapter.delete({ where: { id } });
    return { ok: true };
  });
}
