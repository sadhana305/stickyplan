"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { api, subjectColor } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard, PageHeader, EmptyState, LoadingCards, ErrorState, Ring, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  ListChecks,
  Sparkles,
  Repeat2,
  Timer,
  TrendingUp,
  SkipForward,
  ArrowRight,
  CalendarX2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DashData = {
  today: {
    date: string;
    items: {
      id: string;
      topicId: string | null;
      title: string | null;
      chapter: string | null;
      subject: string | null;
      type: string;
      minutes: number;
      status: string;
      extra: boolean;
      approved: boolean;
    }[];
  };
  progress: { totalTopics: number; completedTopics: number; syllabusPct: number; pendingTopics: number };
  exams: { id: string; title: string; date: string; subject: string | null; daysLeft: number }[];
  streak: { current: number; longest: number; todayDone: boolean; nextMilestone: number | null };
  streakMessage: string;
  recentQuizzes: { id: string; date: string; score: number | null; total: number | null; accuracy: number | null }[];
  revisionsDue: { id: string; topicTitle: string; subject: string; dueDate: string; weak: boolean }[];
  weekly: { date: string; tasks: number; minutes: number; quizzes: number; accuracy: number | null }[];
  suggestions: string[];
  unreadNotifications: number;
};

export function Dashboard() {
  const { setView } = useApp();
  const { toast } = useToast();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<DashData>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load dashboard."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mark(itemId: string, status: "DONE" | "SKIPPED" | "POSTPONED") {
    setBusyItem(itemId);
    try {
      await api("/api/plan-items", { method: "PATCH", body: { id: itemId, status } });
      if (status === "DONE") toast({ title: "Nice work! Topic completed ✅" });
      if (status === "POSTPONED") toast({ title: "Moved to your next study day. No stress. 🌤️" });
      load();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyItem(null);
    }
  }

  async function genSuggestion() {
    setAiBusy(true);
    try {
      const r = await api<{ suggestion: string }>("/api/dashboard/suggestion");
      setAiSuggestion(r.suggestion);
    } catch (e) {
      toast({ title: "AI suggestion failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data)
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 bg-muted rounded-lg animate-pulse" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <LoadingCards count={4} />
      </div>
    );

  const pendingToday = data.today.items.filter((i) => i.status === "PENDING");
  const doneToday = data.today.items.filter((i) => i.status === "DONE");
  const totalMinutes = data.today.items.reduce((a, i) => a + i.minutes, 0);
  const doneMinutes = doneToday.reduce((a, i) => a + i.minutes, 0);
  const dayPct = data.today.items.length ? Math.round((doneToday.length / data.today.items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${useApp.getState().user?.name?.split(" ")[0] ?? "there"} 👋`}
        subtitle="Here's your calm plan for today."
        icon={<CalendarCheck2 className="h-5 w-5" />}
        action={
          <Button className="rounded-full" onClick={() => setView("quiz")}>
            <Flame className="h-4 w-4 mr-1.5" /> Take today's quiz
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<ListChecks className="h-5 w-5" />}
          label="Today"
          value={`${doneToday.length}/${data.today.items.length}`}
          sub={`${pendingToday.length} task${pendingToday.length === 1 ? "" : "s"} left`}
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Quiz streak"
          value={`${data.streak.current} day${data.streak.current === 1 ? "" : "s"}`}
          sub={data.streak.nextMilestone ? `Next milestone: ${data.streak.nextMilestone}` : "Legend mode!"}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Syllabus done"
          value={`${data.progress.syllabusPct}%`}
          sub={`${data.progress.completedTopics}/${data.progress.totalTopics} topics`}
        />
        <StatCard
          icon={<Repeat2 className="h-5 w-5" />}
          label="Revisions due"
          value={data.revisionsDue.length}
          sub={data.revisionsDue.length ? "Quick wins waiting" : "All caught up"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Today's tasks */}
        <Card className="lg:col-span-2 rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <CalendarCheck2 className="h-4.5 w-4.5 text-mint" /> Today's study tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.today.items.length === 0 ? (
              <EmptyState
                title="No tasks scheduled for today"
                description="Generate a plan in the Study Planner and your topics will show up here."
                action={
                  <Button className="rounded-full" onClick={() => setView("planner")}>
                    Open Study Planner <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {data.today.items.map((item, idx) => {
                  const color = subjectColor(null);
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border p-3 transition-all ${
                        item.status === "DONE" ? "bg-mint-soft/50 border-mint/30" : "bg-card hover:shadow-sm"
                      }`}
                    >
                      <span className="hidden sm:flex h-8 w-8 rounded-full bg-muted items-center justify-center text-xs font-extrabold text-muted-foreground shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${item.status === "DONE" ? "line-through opacity-60" : ""}`}>
                          {item.title ?? "Study topic"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          {item.subject ? <Badge className={`${color.chip} border-0 text-[10px]`}>{item.subject}</Badge> : null}
                          {item.chapter ? <span className="truncate max-w-40">{item.chapter}</span> : null}
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />~{item.minutes} min</span>
                          {item.extra ? <Badge className="bg-lavender-soft text-violet-800 dark:text-violet-100 border-0 text-[10px]">extra · needs approval</Badge> : null}
                        </p>
                      </div>
                      {item.status === "PENDING" ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.extra ? (
                            <Button
                              size="sm"
                              className="rounded-full h-8"
                              disabled={busyItem === item.id}
                              onClick={() => api("/api/plan-items", { method: "PATCH", body: { id: item.id, approved: true } }).then(load)}
                            >
                              Approve
                            </Button>
                          ) : null}
                          <Button size="sm" className="rounded-full h-8" disabled={busyItem === item.id} onClick={() => mark(item.id, "DONE")}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Done
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busyItem === item.id} onClick={() => mark(item.id, "POSTPONED")}>
                            <CalendarX2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Later</span>
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Skip task" disabled={busyItem === item.id} onClick={() => mark(item.id, "SKIPPED")}>
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge className="bg-mint text-white border-0 rounded-full">Completed</Badge>
                      )}
                    </div>
                  );
                })}
                {/* Break hint */}
                {data.today.items.length > 2 ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Timer className="h-3.5 w-3.5" /> Tip: take a 10-minute break after every 2 topics — your plan already budgets for it.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold">Today's progress</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Ring value={dayPct} label="done" />
              <div className="text-sm space-y-1.5">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-mint" /> {doneToday.length} completed
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Circle className="h-4 w-4" /> {pendingToday.length} remaining
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> {doneMinutes}/{totalMinutes} min
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <CalendarX2 className="h-4.5 w-4.5 text-peach" /> Upcoming exams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.exams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exams scheduled. Add exam dates in My Subjects → Exams.</p>
              ) : (
                data.exams.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.subject ?? "General"} · {e.date}</p>
                    </div>
                    <Badge
                      className={`rounded-full shrink-0 border-0 ${
                        e.daysLeft <= 3 ? "bg-rose-500 text-white" : e.daysLeft <= 7 ? "bg-peach text-white" : "bg-mint-soft text-teal-800 dark:text-teal-100"
                      }`}
                    >
                      {e.daysLeft === 0 ? "Today!" : `${e.daysLeft}d`}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Second row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold">Weekly study activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weekly} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <ChartTooltip
                    cursor={{ fill: "var(--mint-soft)", opacity: 0.4 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                    formatter={(value: number | string, name: string) =>
                      name === "minutes" ? [`${value} min`, "Study time"] : [value, "Tasks"]
                    }
                  />
                  <Bar dataKey="minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold">Recent quiz scores</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentQuizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quizzes yet — take today's quiz to start your streak!</p>
            ) : (
              <div className="space-y-2.5">
                {data.recentQuizzes.map((q) => (
                  <div key={q.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{q.score ?? 0}/{q.total ?? 0} correct</span>
                        <span className="text-muted-foreground">{q.date}</span>
                      </div>
                      <Progress value={q.accuracy ?? 0} className="h-2" />
                    </div>
                    <span className="text-sm font-extrabold w-11 text-right">{q.accuracy ?? 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <Repeat2 className="h-4.5 w-4.5 text-lavender" /> Pending revisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.revisionsDue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due — your memory is nicely refreshed. ✨</p>
            ) : (
              <div className="space-y-2">
                {data.revisionsDue.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{r.topicTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.subject}</p>
                    </div>
                    {r.weak ? <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200 border-0 rounded-full text-[10px]">weak</Badge> : null}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="rounded-full w-full" onClick={() => setView("revision")}>
                  Open Revision Centre
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      <Card className="rounded-xl border-mint/30 bg-gradient-to-br from-mint-soft/40 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-mint" /> Study suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.suggestions.map((s, i) => (
            <p key={i} className="text-sm leading-relaxed flex gap-2">
              <span className="text-mint mt-0.5">•</span> {s}
            </p>
          ))}
          <div className="pt-2">
            {aiBusy ? (
              <AIRunning label="Your AI coach is thinking…" />
            ) : aiSuggestion ? (
              <div className="rounded-lg border bg-card p-3 text-sm leading-relaxed animate-fade-up">
                <p className="font-extrabold text-xs uppercase tracking-wide text-mint mb-1">Today's AI coaching</p>
                {aiSuggestion}
              </div>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full" onClick={genSuggestion}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Get my AI coaching tip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">{data.streakMessage}</p>
    </div>
  );
}
