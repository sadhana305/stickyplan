import { db } from "@/lib/db";
import { withUser, parseBody, json } from "@/lib/api-helpers";

/** Full syllabus tree for the signed-in student. */
export async function GET() {
  return withUser(async (user) => {
    const subjects = await db.subject.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: { topics: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    return { subjects };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ name?: string; semester?: string; color?: string }>(req);
  return withUser(async (user) => {
    const name = (body.name ?? "").trim();
    if (!name) throw new Error("Please give the subject a name.");
    const subject = await db.subject.create({
      data: {
        userId: user.id,
        name,
        semester: body.semester?.trim() || null,
        color: body.color || "mint",
      },
    });
    return { subject };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{ id?: string; name?: string; semester?: string; color?: string }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing subject id.");
    const data: Record<string, string | null> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) throw new Error("Subject name cannot be empty.");
      data.name = body.name.trim();
    }
    if (body.semester !== undefined) data.semester = body.semester?.trim() || null;
    if (body.color !== undefined) data.color = body.color;
    const subject = await db.subject.updateMany({ where: { id: body.id, userId: user.id }, data });
    if (subject.count === 0) throw new Error("Subject not found.");
    return { ok: true };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) return json({ error: "Missing id." }, 400);
    await db.subject.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
