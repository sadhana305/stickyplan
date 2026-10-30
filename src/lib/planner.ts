import { addDaysStr, daysBetween, todayStr, weekdayOf } from "./dates";

export type PlannerUser = {
  studyHoursPerDay: number;
  studyDays: string; // "1,2,3,4,5"
  weekdayLimits: string; // JSON {"0":0,...}
  dailyTopicLimit: number;
  planningMode: string;
};

export type PlannerTopic = {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  chapterName: string;
  difficulty: string; // EASY | MEDIUM | HARD
  importance: number;
  estMinutes: number;
};

export type PlannerExam = { subjectId: string | null; title: string; date: string };

export type PlannedItem = {
  topicId: string;
  date: string;
  type: "LEARN" | "REVISE";
  minutes: number;
  extra: boolean;
  approved: boolean;
  topicTitle: string;
  chapterTitle: string;
  subjectTitle: string;
};

const DIFF_MIN: Record<string, number> = { EASY: 30, MEDIUM: 50, HARD: 75 };
const DIFF_WEIGHT: Record<string, number> = { HARD: 0, MEDIUM: 1, EASY: 2 };

export function parseWeekdayLimits(raw: string): Record<number, number> {
  try {
    const obj = JSON.parse(raw);
    const out: Record<number, number> = {};
    for (let i = 0; i < 7; i++) out[i] = Math.max(0, Math.min(12, Number(obj[i] ?? 0) || 0));
    return out;
  } catch {
    return { 0: 0, 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 4 };
  }
}

function examBucket(daysLeft: number): number {
  if (daysLeft <= 7) return 0;
  if (daysLeft <= 14) return 1;
  if (daysLeft <= 30) return 2;
  return 3;
}

function nextExamFor(topic: PlannerTopic, exams: PlannerExam[], today: string): number {
  const relevant = exams.filter((e) => e.subjectId === topic.subjectId && daysBetween(today, e.date) >= 0);
  if (relevant.length === 0) return 365;
  return Math.min(...relevant.map((e) => daysBetween(today, e.date)));
}

export type PlanResult = {
  items: PlannedItem[];
  warnings: string[];
  horizonEnd: string;
};

/**
 * Deterministic planner: walks study days forward from `today`, prioritising
 * near-exam + hard + important topics, respecting per-weekday topic limits,
 * available hours (balanced mode), and never exceeding limits (fixed mode).
 */
export function generatePlan(
  user: PlannerUser,
  topics: PlannerTopic[],
  exams: PlannerExam[],
  mode: string,
  today: string = todayStr(),
  horizonDays = 90
): PlanResult {
  const warnings: string[] = [];
  const limits = parseWeekdayLimits(user.weekdayLimits);
  const studyDays = new Set(
    user.studyDays
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
  );

  // Sorted queue: exam proximity bucket → difficulty → importance
  const queue = [...topics].sort((a, b) => {
    const ea = examBucket(nextExamFor(a, exams, today));
    const eb = examBucket(nextExamFor(b, exams, today));
    if (ea !== eb) return ea - eb;
    const da = DIFF_WEIGHT[a.difficulty] ?? 1;
    const db = DIFF_WEIGHT[b.difficulty] ?? 1;
    if (da !== db) return da - db;
    return b.importance - a.importance;
  });

  // Last exam date in range
  const futureExams = exams.filter((e) => daysBetween(today, e.date) >= 0);
  const lastExam = futureExams.length > 0 ? futureExams.map((e) => e.date).sort().at(-1)! : addDaysStr(today, horizonDays);
  const horizonEnd = lastExam;

  // Feasibility warning
  const studyDayCount = Array.from({ length: Math.max(0, daysBetween(today, lastExam)) }).filter((_, i) => {
    const d = addDaysStr(today, i + 1);
    return studyDays.has(weekdayOf(d)) && limits[weekdayOf(d)] > 0;
  }).length;
  if (topics.length > 0) {
    const requiredPerDay = Math.ceil(topics.length / Math.max(1, studyDayCount));
    const maxLimit = Math.max(...Object.values(limits), user.dailyTopicLimit);
    if (requiredPerDay > maxLimit) {
      warnings.push(
        `Heads up: you have ${topics.length} pending topics but only ${studyDayCount} study days before your last exam (${lastExam}). That needs ~${requiredPerDay} topics/day, which is above your current limit of ${maxLimit}. Consider raising your daily topic limit, adding study days, or moving your exam plan.`
      );
    }
    if (studyDayCount === 0) {
      warnings.push("No upcoming study days found. Check your preferred study days in Settings so the planner can schedule topics.");
    }
  }

  const items: PlannedItem[] = [];
  const minutesBudget = Math.max(30, Math.round(user.studyHoursPerDay * 60));
  const q = [...queue];
  const usedTopicIds = new Set<string>();

  for (let offset = 0; offset <= horizonDays && q.length > 0; offset++) {
    const date = addDaysStr(today, offset);
    const wd = weekdayOf(date);
    if (!studyDays.has(wd)) continue;
    const limit = limits[wd] ?? 0;
    if (limit <= 0) continue;

    const dayMinutes = minutesBudget;
    let spent = 0;
    let count = 0;
    const dayExtras: PlannedItem[] = [];

    while (q.length > 0 && count < limit) {
      const topic = q[0];
      const minutes = topic.estMinutes || DIFF_MIN[topic.difficulty] || 45;

      if (mode === "BALANCED" && count > 0 && spent + minutes > dayMinutes + 15) {
        break; // balanced: respect available time, may finish under topic limit
      }

      q.shift();
      usedTopicIds.add(topic.id);
      items.push({
        topicId: topic.id,
        date,
        type: "LEARN",
        minutes,
        extra: false,
        approved: true,
        topicTitle: topic.name,
        chapterTitle: topic.chapterName,
        subjectTitle: topic.subjectName,
      });
      spent += minutes + 10; // 10-min break between topics
      count++;
    }

    // Flexible mode: when exams are near, suggest extra topics (need approval)
    if (mode === "FLEXIBLE") {
      const nearExam = exams.some(
        (e) => e.date >= date && daysBetween(date, e.date) <= 14
      );
      if (nearExam && count >= limit && q.length > 0) {
        const extras = Math.min(2, q.length);
        let extraSpent = spent;
        for (let i = 0; i < extras; i++) {
          const topic = q[i];
          const minutes = topic.estMinutes || DIFF_MIN[topic.difficulty] || 45;
          if (extraSpent + minutes > minutesBudget * 1.6) break;
          dayExtras.push({
            topicId: topic.id,
            date,
            type: "LEARN",
            minutes,
            extra: true,
            approved: false,
            topicTitle: topic.name,
            chapterTitle: topic.chapterName,
            subjectTitle: topic.subjectName,
          });
          extraSpent += minutes;
        }
        // Only remove from queue if approved later; for now peek-only (kept in queue)
        // We insert them as suggestions; they stay in the queue for normal scheduling.
        items.push(...dayExtras);
      }
    }
  }

  // Any topics that never fit inside the horizon
  if (q.length > 0) {
    warnings.push(
      `${q.length} topic${q.length > 1 ? "s" : ""} could not fit before ${horizonEnd} with your current limits. They will be scheduled as soon as earlier days free up (mark topics done to pull them forward).`
    );
  }

  return { items, warnings, horizonEnd };
}
