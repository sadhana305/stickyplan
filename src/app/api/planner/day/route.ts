import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";

/** One day's plan, merged with revision sessions due that day. */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  return withUser(async (user) => {
    const planItems = await db.planItem.findMany({
      where: { userId: user.id, ...(date ? { date } : {}) },
      orderBy: [{ date: "asc" }, { order: "asc" }],
    });

    let revisions: { id: string; topicTitle: string; subjectTitle: string; stage: number; weak: boolean }[] = [];
    if (date) {
      const revisionItems = await db.revisionItem.findMany({
        where: { userId: user.id, dueDate: date, completed: false },
        include: {
          topic: {
            select: {
              name: true,
              subject: { select: { name: true } },
            },
          },
        },
      });
      revisions = revisionItems.map((r) => ({
        id: r.id,
        topicTitle: r.topic.name,
        subjectTitle: r.topic.subject.name,
        stage: r.stage,
        weak: r.weak,
      }));
    }

    return { planItems, revisions };
  });
}
