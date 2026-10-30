"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, ErrorState } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Flame, Trophy, CalendarDays, ListChecks } from "lucide-react";

type StreakData = {
  current: number;
  longest: number;
  todayDone: boolean;
  nextMilestone: number | null;
  milestones: number[];
  totalQuizDays: number;
  totalQuizzes: number;
  calendar: { date: string; done: boolean; qualifying: boolean }[];
  message: string;
};

export function StreakView() {
  const setView = useApp((s) => s.setView);
  const [data, setData] = useState<StreakData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<StreakData>("/api/streak").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load streaks."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );

  return (
    <div className="space-y-5">
      <PageHeader title="Quiz Streaks" subtitle="Small daily wins, celebrated kindly." icon={<Flame className="h-5 w-5" />} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="rounded-xl border-peach/40 bg-gradient-to-br from-peach-soft/50 to-transparent">
          <CardContent className="pt-5 text-center">
            <Flame className="h-8 w-8 mx-auto text-peach" />
            <p className="text-4xl font-extrabold mt-1">{data.current}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-1">Current streak (days)</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-5 text-center">
            <Trophy className="h-8 w-8 mx-auto text-lemon" />
            <p className="text-4xl font-extrabold mt-1">{data.longest}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-1">Longest streak</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-5 text-center">
            <ListChecks className="h-8 w-8 mx-auto text-mint" />
            <p className="text-4xl font-extrabold mt-1">{data.totalQuizDays}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-1">Qualifying quiz days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-mint/40 bg-mint-soft/30 dark:bg-mint-soft/10">
        <CardContent className="pt-5 text-sm leading-relaxed">
          {data.message}{" "}
          {!data.todayDone ? (
            <Button size="sm" className="rounded-full ml-2" onClick={() => setView("quiz")}>Take today's quiz</Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-extrabold flex items-center gap-2"><CalendarDays className="h-4.5 w-4.5 text-mint" /> Last 12 weeks</CardTitle>
          <p className="text-xs text-muted-foreground">A quiz counts when you attempt 4+ questions with 50%+ accuracy. Multiple quizzes in a day count as one streak day.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-14 gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
            {data.calendar.map((d) => (
              <div
                key={d.date}
                title={`${d.date}${d.qualifying ? " — qualifying quiz ✓" : d.done ? " — quiz attempted" : ""}`}
                className={cn(
                  "aspect-square rounded-md",
                  d.qualifying ? "bg-mint" : d.done ? "bg-lemon/60" : "bg-muted"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-mint inline-block" /> qualifying quiz</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-lemon/60 inline-block" /> attempted</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted inline-block" /> no quiz</span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Milestones</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.milestones.map((m) => {
            const reached = data.current >= m || data.longest >= m;
            const progress = Math.min(100, Math.round((data.current / m) * 100));
            return (
              <div key={m}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={cn("font-bold", reached ? "text-mint" : "")}>
                    {m} days {reached ? "🏆" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{data.current}/{m}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-1">Miss a day? No guilt — just start again. Consistency beats perfection. 🌤️</p>
        </CardContent>
      </Card>
    </div>
  );
}
