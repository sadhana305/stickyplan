import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (user) => {
    const exams = await db.exam.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      include: { subject: { select: { name: true } } },
    });
    return { exams };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ subjectId?: string | null; title?: string; date?: string }>(req);
  return withUser(async (user) => {
    const title = (body.title ?? "").trim();
    if (!title || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      throw new Error("Exam needs a title and a valid date.");
    if (body.subjectId) {
      const subject = await db.subject.findFirst({ where: { id: body.subjectId, userId: user.id } });
      if (!subject) throw new Error("Subject not found.");
    }
    const exam = await db.exam.create({
      data: { userId: user.id, subjectId: body.subjectId || null, title, date: body.date },
    });
    return { exam };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    await db.exam.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
