import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

type OnboardingPayload = {
  educationLevel?: string;
  course?: string;
  semester?: string;
  studyHoursPerDay?: number;
  studyDays?: string;
  weekdayLimits?: Record<string, number>;
  timeSlots?: string;
  dailyTopicLimit?: number;
  learningPrefs?: string;
  planningMode?: string;
  subjects?: { name: string; examDate?: string }[];
};

export async function POST(req: Request) {
  const body = await parseBody<OnboardingPayload>(req);
  return withUser(async (user) => {
    const data: Record<string, unknown> = { onboardingDone: true };
    if (body.educationLevel) data.educationLevel = body.educationLevel;
    if (body.course) data.course = body.course;
    if (body.semester) data.semester = body.semester;
    if (typeof body.studyHoursPerDay === "number")
      data.studyHoursPerDay = Math.max(0.5, Math.min(16, body.studyHoursPerDay));
    if (body.studyDays) data.studyDays = body.studyDays;
    if (body.weekdayLimits) data.weekdayLimits = JSON.stringify(body.weekdayLimits);
    if (body.timeSlots !== undefined) data.timeSlots = body.timeSlots;
    if (typeof body.dailyTopicLimit === "number")
      data.dailyTopicLimit = Math.max(1, Math.min(12, body.dailyTopicLimit));
    if (body.learningPrefs !== undefined) data.learningPrefs = body.learningPrefs;
    if (body.planningMode) data.planningMode = body.planningMode;

    const existingSubjects = await db.subject.findMany({ where: { userId: user.id }, select: { name: true } });
    const existingNames = new Set(existingSubjects.map((s) => s.name.toLowerCase()));

    let createdSubjects = 0;
    let createdExams = 0;
    for (const s of body.subjects ?? []) {
      const name = (s.name ?? "").trim();
      if (!name || existingNames.has(name.toLowerCase())) continue;
      const subject = await db.subject.create({
        data: { userId: user.id, name, semester: body.semester ?? null },
      });
      createdSubjects++;
      if (s.examDate) {
        await db.exam.create({
          data: { userId: user.id, subjectId: subject.id, title: `${name} exam`, date: s.examDate },
        });
        createdExams++;
      }
    }

    await db.user.update({ where: { id: user.id }, data });
    await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Your profile is ready 🎉",
        body: "Add your full syllabus next — upload a PDF or photos, or type your chapters and topics.",
        dedupeKey: "onboarding-done",
      },
    });
    return { ok: true, createdSubjects, createdExams };
  });
}
