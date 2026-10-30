import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (user) => {
    const { passwordHash: _ph, ...safe } = user;
    void _ph;
    return { profile: safe };
  });
}

const ALLOWED_FIELDS = [
  "name",
  "educationLevel",
  "course",
  "semester",
  "studyHoursPerDay",
  "studyDays",
  "weekdayLimits",
  "timeSlots",
  "dailyTopicLimit",
  "learningPrefs",
  "planningMode",
  "onboardingDone",
  "themePrefs",
] as const;

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  return withUser(async (user) => {
    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) data[key] = body[key];
    }
    if (typeof data.studyHoursPerDay === "number")
      data.studyHoursPerDay = Math.max(0.5, Math.min(16, data.studyHoursPerDay));
    if (typeof data.dailyTopicLimit === "number")
      data.dailyTopicLimit = Math.max(1, Math.min(12, data.dailyTopicLimit));
    if (typeof data.name === "string" && !data.name.trim()) delete data.name;
    if ("themePrefs" in data) {
      if (data.themePrefs === null) data.themePrefs = null;
      else if (typeof data.themePrefs === "string" && data.themePrefs.length <= 600) data.themePrefs = data.themePrefs;
      else delete data.themePrefs;
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    const { passwordHash: _ph, ...safe } = updated;
    void _ph;
    return { profile: safe };
  });
}
