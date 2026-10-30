import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

type ExtractedTopic = { name?: string; subtopics?: string[] };
type ExtractedChapter = { name?: string; topics?: ExtractedTopic[] };
type ExtractedSubject = { name?: string; chapters?: ExtractedChapter[] };

const COLORS = ["mint", "lavender", "peach", "sky", "lemon", "rose"];

/** Persist a reviewed, extracted syllabus tree. */
export async function POST(req: Request) {
  const body = await parseBody<{ subjects?: ExtractedSubject[]; replace?: boolean }>(req);
  return withUser(async (user) => {
    const subjectsIn = (body.subjects ?? []).filter((s) => (s.name ?? "").trim());
    if (subjectsIn.length === 0) throw new Error("Nothing to import — add at least one subject.");

    if (body.replace) {
      await db.subject.deleteMany({ where: { userId: user.id } });
    }

    const existing = await db.subject.findMany({ where: { userId: user.id }, select: { name: true } });
    const names = new Set(existing.map((s) => s.name.toLowerCase()));

    let subjectsCreated = 0;
    let chaptersCreated = 0;
    let topicsCreated = 0;
    let colorIdx = existing.length % COLORS.length;

    for (const sIn of subjectsIn) {
      const subjectName = (sIn.name ?? "").trim();
      let subject =
        (await db.subject.findFirst({ where: { userId: user.id, name: subjectName } })) ??
        (names.has(subjectName.toLowerCase())
          ? await db.subject.findFirst({ where: { userId: user.id, name: subjectName } })
          : null);

      if (!subject && !names.has(subjectName.toLowerCase())) {
        subject = await db.subject.create({
          data: { userId: user.id, name: subjectName, color: COLORS[colorIdx % COLORS.length] },
        });
        names.add(subjectName.toLowerCase());
        colorIdx++;
        subjectsCreated++;
      }
      if (!subject) continue;

      const existingChapters = await db.chapter.findMany({ where: { subjectId: subject.id } });
      const chapterNames = new Set(existingChapters.map((c) => c.name.toLowerCase()));
      let order = existingChapters.length;

      for (const cIn of sIn.chapters ?? []) {
        const chapterName = (cIn.name ?? "").trim();
        if (!chapterName) continue;
        let chapter = chapterNames.has(chapterName.toLowerCase())
          ? await db.chapter.findFirst({ where: { subjectId: subject.id, name: chapterName } })
          : null;
        if (!chapter) {
          chapter = await db.chapter.create({
            data: { subjectId: subject.id, name: chapterName, order: order++ },
          });
          chapterNames.add(chapterName.toLowerCase());
          chaptersCreated++;
        }

        const existingTopics = await db.topic.findMany({ where: { chapterId: chapter.id } });
        const topicNames = new Set(existingTopics.map((t) => t.name.toLowerCase()));

        for (const tIn of cIn.topics ?? []) {
          const topicName = (tIn.name ?? "").trim();
          if (!topicName || topicNames.has(topicName.toLowerCase())) continue;
          await db.topic.create({
            data: {
              userId: user.id,
              subjectId: subject.id,
              chapterId: chapter.id,
              name: topicName,
              subtopics: JSON.stringify((tIn.subtopics ?? []).map((x) => (x ?? "").trim()).filter(Boolean)),
            },
          });
          topicNames.add(topicName.toLowerCase());
          topicsCreated++;
        }
      }
    }

    return { ok: true, subjectsCreated, chaptersCreated, topicsCreated };
  });
}
