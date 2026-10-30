import { addDaysStr, daysBetween } from "./dates";

export const MILESTONES = [3, 7, 14, 30, 60, 100];

export type StreakInfo = {
  current: number;
  longest: number;
  todayDone: boolean;
  milestone: number | null;
  nextMilestone: number | null;
};

/** Compute streak stats from the set of qualifying quiz dates ("YYYY-MM-DD"). */
export function computeStreak(qualifyingDates: string[], today: string): StreakInfo {
  const set = new Set(qualifyingDates);

  // Current streak: anchored on today (or yesterday if today not yet done)
  let current = 0;
  const anchor = set.has(today) ? today : set.has(addDaysStr(today, -1)) ? addDaysStr(today, -1) : null;
  if (anchor) {
    let d = anchor;
    while (set.has(d)) {
      current++;
      d = addDaysStr(d, -1);
    }
  }

  // Longest streak
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const milestone = MILESTONES.includes(current) ? current : null;
  const nextMilestone = MILESTONES.find((m) => m > current) ?? null;

  return { current, longest, todayDone: set.has(today), milestone, nextMilestone };
}

export const STREAK_MESSAGES = {
  alive: (days: number, next: number | null) =>
    next
      ? `You're on a ${days}-day streak! Just ${next - days} more day${next - days === 1 ? "" : "s"} to reach the ${next}-day milestone. 🌱`
      : `Incredible — a ${days}-day streak! You're a study legend. 🏆`,
  todayDone: (days: number) =>
    `Today's quiz is done — streak protected at ${days} day${days === 1 ? "" : "s"}. Come back tomorrow to keep it growing! ☀️`,
  notYet: (next: number | null) =>
    next
      ? `Complete a qualifying quiz today to start/extend your streak. Every streak begins with a single day — yours can start now! 🌱`
      : `Complete a quiz today to keep your learning rhythm going! 🌱`,
  missed: (longest: number) =>
    `No worries about a missed day — rest is part of learning. Your longest streak so far is ${longest} day${longest === 1 ? "" : "s"}. Ready to start a fresh one? 🌤️`,
};
