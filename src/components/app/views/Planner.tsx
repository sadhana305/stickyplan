"use client";

import { useCallback, useEffect, useState } from "react";
import { api, subjectColor } from "@/lib/client";
import { relativeDay, todayStr, prettyDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Wand2,
  CheckCircle2,
  SkipForward,
  CalendarX2,
  Info,
  AlertTriangle,
  ThumbsUp,
  RefreshCw,
} from "lucide-react";

type PlanItem = {
  id: string;
  date: string;
  type: string;
  minutes: number;
  status: string;
  approved: boolean;
  extra: boolean;
  topicTitle: string | null;
  chapterTitle: string | null;
  subjectTitle: string | null;
  topic?: { status: string } | null;
};

const MODES = [
  { id: "FIXED", label: "Fixed", desc: "Never exceeds your daily topic limit." },
  { id: "FLEXIBLE", label: "Flexible", desc: "Suggests extra topics near exams — you approve." },
  { id: "BALANCED", label: "Balanced", desc: "Fits topics to your time and difficulty." },
];

export function PlannerView() {
  const { toast } = useToast();
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("BALANCED");
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ items: PlanItem[] }>("/api/plan-items")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the plan."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await api<{ scheduled: number; suggestions: number; warnings: string[] }>("/api/planner/generate", {
        method: "POST",
        body: { mode },
      });
      setWarnings(r.warnings);
      toast({
        title: "Plan generated! 📅",
        description: `${r.scheduled} study sessions scheduled${r.suggestions > 0 ? ` + ${r.suggestions} flexible suggestions` : ""}.`,
      });
      load();
    } catch (e) {
      toast({ title: "Could not generate the plan", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function act(item: PlanItem, status: "DONE" | "SKIPPED" | "POSTPONED") {
    setBusyItem(item.id);
    try {
      const r = await api<{ movedTo?: string }>("/api/plan-items", { method: "PATCH", body: { id: item.id, status } });
      if (status === "DONE") toast({ title: "Topic completed ✅" });
      if (status === "POSTPONED") toast({ title: `Rescheduled to ${r.movedTo ? prettyDate(r.movedTo) : "your next study day"}.` });
      load();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyItem(null);
    }
  }

  async function approve(item: PlanItem, approved: boolean) {
    setBusyItem(item.id);
    try {
      await api("/api/plan-items", { method: "PATCH", body: { id: item.id, approved } });
      toast({ title: approved ? "Extra topic added to your day 💪" : "Suggestion declined." });
      load();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyItem(null);
    }
  }

  // Group upcoming items by date
  const byDate = new Map<string, PlanItem[]>();
  (items ?? []).forEach((i) => {
    if (i.extra && !i.approved && i.status !== "DONE") {
      // flexible suggestions shown separately within their day
    }
    const arr = byDate.get(i.date) ?? [];
    arr.push(i);
    byDate.set(i.date, arr);
  });
  const dates = [...byDate.keys()].filter((d) => d >= todayStr()).sort().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Study Planner"
        subtitle="Your AI-organised days, built around your limits and exams."
        icon={<CalendarDays className="h-5 w-5" />}
      />

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Wand2 className="h-4.5 w-4.5 text-mint" /> Generate / regenerate plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all",
                  mode === m.id ? "border-mint bg-mint-soft/60 shadow-sm" : "hover:border-mint/50"
                )}
                aria-pressed={mode === m.id}
              >
                <p className="font-extrabold text-sm">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="rounded-full" onClick={generate} disabled={generating}>
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> Building your plan…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1.5" /> {items && items.length > 0 ? "Regenerate plan" : "Generate plan"}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Regenerating moves all still-pending topics into a fresh schedule — completed history is kept.
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/60 p-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Daily topic limits, study days and hours come from your <b>Settings</b>. The planner prioritises difficult
              and important topics for subjects whose exams are nearest, budgets ~10-minute breaks between topics, and
              warns you when a schedule would be unrealistic.
            </span>
          </div>
          {generating ? <AIRunning label="Balancing difficulty, exam dates and your energy…" /> : null}
          {warnings.length > 0 ? (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm rounded-lg border border-peach/50 bg-peach-soft/60 dark:bg-peach-soft/20 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-peach" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!items ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : dates.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No upcoming study sessions"
          description="Add topics in your Syllabus and press “Generate plan” — the planner will spread them across your study days."
          action={
            <Button className="rounded-full" onClick={generate} disabled={generating}>
              <Wand2 className="h-4 w-4 mr-1.5" /> Generate plan
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {dates.map((date) => {
            const dayItems = byDate.get(date) ?? [];
            const regular = dayItems.filter((i) => !(i.extra && !i.approved && i.status === "PENDING"));
            const suggestions = dayItems.filter((i) => i.extra && !i.approved && i.status === "PENDING");
            const doneCount = dayItems.filter((i) => i.status === "DONE").length;
            const totalMin = dayItems.reduce((a, i) => a + i.minutes, 0);
            return (
              <Card key={date} className="rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-muted/50 border-b">
                  <div>
                    <p className="font-extrabold">{relativeDay(date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {prettyDate(date)} · {doneCount}/{dayItems.length} done · ~{totalMin} min
                    </p>
                  </div>
                  {date === todayStr() ? <Badge className="bg-mint text-white border-0 rounded-full">Today</Badge> : null}
                </div>
                <CardContent className="pt-3 space-y-2">
                  {regular.map((item) => (
                    <PlanRow key={item.id} item={item} busy={busyItem === item.id} onAct={act} />
                  ))}
                  {suggestions.length > 0 ? (
                    <div className="rounded-xl border border-dashed border-lavender/60 bg-lavender-soft/40 dark:bg-lavender-soft/10 p-3 space-y-2">
                      <p className="text-xs font-extrabold text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
                        <ThumbsUp className="h-3.5 w-3.5" /> Flexible suggestions — exams are near. Add these?
                      </p>
                      {suggestions.map((item) => (
                        <PlanRow key={item.id} item={item} busy={busyItem === item.id} onAct={act} onApprove={approve} />
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlanRow({
  item,
  busy,
  onAct,
  onApprove,
}: {
  item: PlanItem;
  busy: boolean;
  onAct: (item: PlanItem, status: "DONE" | "SKIPPED" | "POSTPONED") => void;
  onApprove?: (item: PlanItem, approved: boolean) => void;
}) {
  const color = subjectColor(null);
  return (
    <div className={cn("flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border p-3", item.status === "DONE" ? "bg-mint-soft/50 border-mint/30" : "bg-card")}>
      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-sm truncate", item.status === "DONE" && "line-through opacity-60")}>{item.topicTitle ?? "Topic"}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          {item.subjectTitle ? <Badge className={`${color.chip} border-0 text-[10px]`}>{item.subjectTitle}</Badge> : null}
          <span>~{item.minutes} min</span>
          {item.extra ? <Badge className="bg-lavender-soft text-violet-800 dark:text-violet-100 border-0 text-[10px]">suggested extra</Badge> : null}
          {item.status === "SKIPPED" ? <Badge variant="outline" className="rounded-full text-[10px]">skipped</Badge> : null}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.status === "PENDING" ? (
          onApprove ? (
            <>
              <Button size="sm" className="rounded-full h-8" disabled={busy} onClick={() => onApprove(item, true)}>Add</Button>
              <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => onApprove(item, false)}>No thanks</Button>
            </>
          ) : (
            <>
              <Button size="sm" className="rounded-full h-8" disabled={busy} onClick={() => onAct(item, "DONE")}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Done
              </Button>
              <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => onAct(item, "POSTPONED")}>
                <CalendarX2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Later</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Skip" disabled={busy} onClick={() => onAct(item, "SKIPPED")}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </>
          )
        ) : item.status === "DONE" ? (
          <Badge className="bg-mint text-white border-0 rounded-full">Done</Badge>
        ) : null}
      </div>
    </div>
  );
}
