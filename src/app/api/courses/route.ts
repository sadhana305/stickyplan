import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { COURSES, PLATFORMS, COURSE_CATEGORIES } from "@/lib/courses";

export async function GET() {
  return withUser(async (user) => {
    const bookmarks = await db.courseBookmark.findMany({ where: { userId: user.id } });
    const map = new Map(bookmarks.map((b) => [b.courseId, b]));
    return {
      courses: COURSES.map((c) => ({
        ...c,
        bookmarked: map.has(c.id),
        progress: map.get(c.id)?.progress ?? 0,
      })),
      platforms: PLATFORMS,
      categories: COURSE_CATEGORIES,
    };
  });
}
