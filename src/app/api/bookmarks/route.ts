import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { COURSES } from "@/lib/courses";

export async function POST(req: Request) {
  const body = await parseBody<{ courseId?: string }>(req);
  return withUser(async (user) => {
    if (!body.courseId || !COURSES.some((c) => c.id === body.courseId))
      throw new Error("Unknown course.");
    const existing = await db.courseBookmark.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: body.courseId } },
    });
    if (existing) {
      await db.courseBookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }
    await db.courseBookmark.create({ data: { userId: user.id, courseId: body.courseId } });
    return { bookmarked: true };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{ courseId?: string; progress?: number }>(req);
  return withUser(async (user) => {
    if (!body.courseId || typeof body.progress !== "number") throw new Error("Missing course or progress.");
    const progress = Math.max(0, Math.min(100, Math.round(body.progress)));
    const existing = await db.courseBookmark.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: body.courseId } },
    });
    if (!existing) throw new Error("Bookmark the course first to track progress.");
    const updated = await db.courseBookmark.update({ where: { id: existing.id }, data: { progress } });
    return { progress: updated.progress };
  });
}
