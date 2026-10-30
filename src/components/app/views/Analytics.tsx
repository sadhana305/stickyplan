"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, ErrorState, StatCard } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { LineChart as LineChartIcon, Clock, ListChecks, Gauge, Repeat2, Sparkles, ThumbsUp, ThumbsDown, BookMarked } from "lucide-react";

type AnalyticsData = {
  subjectProgress: { subject: string; total: number; completed: number; pct: number }[];
  accuracyTrend: { date: string; accuracy: number; score: number; total: number }[];
  weekly: { date: string; tasks: number; minutes: number }[];
  strongTopics: { topic: string; accuracy: number; attempts: number }[];
  weakTopics: { topic: string; accuracy: number; attempts: number }[];
  totals: {
    studyMinutes: number;
    topicsCompleted: number;
    quizzes: number;
    avgAccuracy: number | null;
    revisionsCompleted: number;
    materialsGenerated: number;
  };
  recommendations: string[];
};

export function AnalyticsView() {
  const setView = useApp((s) => s.setView);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<AnalyticsData>("/api/analytics").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load analytics."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );

  const hours = Math.round((data.totals.studyMinutes / 60) * 10) / 10;

  return (
    <div className="space-y-5">
      <PageHeader title="Performance" subtitle="Your progress, accuracy and study rhythm — with honest advice." icon={<LineChartIcon className="h-5 w-5" />} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Study time (30d)" value={`${hours}h`} sub={`${data.totals.studyMinutes} minutes planned-done`} />
        <StatCard icon={<ListChecks className="h-5 w-5" />} label="Topics completed" value={data.totals.topicsCompleted} />
        <StatCard icon={<Gauge className="h-5 w-5" />} label="Quiz average" value={data.totals.avgAccuracy !== null ? `${data.totals.avgAccuracy}%` : "—"} sub={`${data.totals.quizzes} quizzes taken`} />
        <StatCard icon={<Repeat2 className="h-5 w-5" />} label="Revisions done" value={data.totals.revisionsCompleted} sub={`${data.totals.materialsGenerated} materials generated`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Quiz accuracy trend</CardTitle></CardHeader>
          <CardContent>
            {data.accuracyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Take your first quiz to see your trend here.</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.accuracyTrend} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                    <ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                    <Line type="monotone" dataKey="accuracy" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-1)" }} name="Accuracy %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Weekly activity (tasks & minutes)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <ChartTooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
                  <Bar dataKey="tasks" name="Tasks done" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="minutes" name="Minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">Subject-wise progress</CardTitle></CardHeader>
        <CardContent>
          {data.subjectProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Add your syllabus to see subject progress.</p>
          ) : (
            <div className="space-y-3">
              {data.subjectProgress.map((s) => (
                <div key={s.subject}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold">{s.subject}</span>
                    <span className="text-xs text-muted-foreground">{s.completed}/{s.total} topics · {s.pct}%</span>
                  </div>
                  <Progress value={s.pct} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <TopicList title="Strong topics" icon={<ThumbsUp className="h-4.5 w-4.5 text-mint" />} topics={data.strongTopics} tone="good" empty="Quiz a bit more to discover your strengths." />
        <TopicList title="Topics needing improvement" icon={<ThumbsDown className="h-4.5 w-4.5 text-rose-500" />} topics={data.weakTopics} tone="bad" empty="No weak topics flagged — nice! Or take another quiz to probe deeper." />
      </div>

      <Card className="rounded-xl border-lavender/40 bg-gradient-to-br from-lavender-soft/40 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-extrabold flex items-center gap-2"><Sparkles className="h-4.5 w-4.5 text-lavender" /> AI recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recommendations.map((r, i) => (
            <p key={i} className="text-sm leading-relaxed flex gap-2"><span className="text-lavender mt-0.5">•</span> {r}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TopicList({ title, icon, topics, tone, empty }: { title: string; icon: React.ReactNode; topics: { topic: string; accuracy: number; attempts: number }[]; tone: "good" | "bad"; empty: string }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2.5">
            {topics.map((t) => (
              <div key={t.topic} className="flex items-center gap-3">
                <span className="text-sm font-bold flex-1 truncate">{t.topic}</span>
                <Badge className={cn("rounded-full border-0", t.accuracy >= 75 ? "bg-mint text-white" : "bg-rose-500 text-white")}>{t.accuracy}%</Badge>
                <span className="text-[10px] text-muted-foreground w-14 text-right">{t.attempts} attempt{t.attempts > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
