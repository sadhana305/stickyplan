import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (id) {
      const set = await db.questionSet.findFirst({ where: { id, userId: user.id } });
      if (!set) throw new Error("Question set not found.");
      return { set: { ...set, questions: JSON.parse(set.questions), params: JSON.parse(set.params) } };
    }
    const sets = await db.questionSet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, createdAt: true, params: true },
    });
    return {
      sets: sets.map((s) => ({ ...s, params: JSON.parse(s.params) })),
    };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    await db.questionSet.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
