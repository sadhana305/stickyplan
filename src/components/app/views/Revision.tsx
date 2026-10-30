"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, ErrorState } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Repeat2, CheckCircle2, RotateCcw, CalendarClock, Flame } from "lucide-react";

type RevisionItem = {
  id: string;
  topicId: string;
  topicTitle: string;
  subject: string;
  stage: number;
  totalStages: number;
  dueDate: string;
  overdue: boolean;
  dueToday: boolean;
  daysAway: number;
  weak: boolean;
  intervals: number[];
};
type RevisionsData = {
  due: RevisionItem[];
  upcoming: RevisionItem[];
  completedCount: number;
};

export function RevisionView() {
  const { toast } = useToast();
  const [data, setData] = useState<RevisionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<RevisionsData>("/api/revisions").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not load revisions."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function mark(item: RevisionItem, action: "revised" | "again") {
    setBusy(item.id);
    try {
      const r = await api<{ completed?: boolean; nextDue?: string }>("/api/revisions", { method: "POST", body: { id: item.id, action } });
      toast({
        title: action === "again" ? "No problem — we'll try again tomorrow 🌤️" : r.completed ? "Revision ladder complete! Topic mastered 🎉" : `Scheduled again in ${r.nextDue ? "a few" : "a few"} days ✅`,
      });
      load();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Revision Centre"
        subtitle="Spaced repetition: topics return after 1, 3, 7, 14 and 30 days. Weak topics come back sooner."
        icon={<Repeat2 className="h-5 w-5" />}
      />

      <div className="grid sm:grid-cols-3 gap-3 text-center">
        <Card className="rounded-xl"><CardContent className="pt-5"><p className="text-3xl font-extrabold text-peach">{data.due.length}</p><p className="text-xs font-bold text-muted-foreground uppercase mt-1">Due now</p></CardContent></Card>
        <Card className="rounded-xl"><CardContent className="pt-5"><p className="text-3xl font-extrabold text-sky">{data.upcoming.length}</p><p className="text-xs font-bold text-muted-foreground uppercase mt-1">Upcoming</p></CardContent></Card>
        <Card className="rounded-xl"><CardContent className="pt-5"><p className="text-3xl font-extrabold text-mint">{data.completedCount}</p><p className="text-xs font-bold text-muted-foreground uppercase mt-1">Ladders completed</p></CardContent></Card>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-extrabold flex items-center gap-2"><Flame className="h-4.5 w-4.5 text-peach" /> Due today or overdue</CardTitle>
        </CardHeader>
        <CardContent>
          {data.due.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing due right now" description="When you complete topics (or miss quiz questions), they'll be scheduled here automatically." />
          ) : (
            <div className="space-y-2">
              {data.due.map((r) => (
                <RevisionRow key={r.id} item={r} busy={busy === r.id} onMark={mark} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data.upcoming.length > 0 ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold flex items-center gap-2"><CalendarClock className="h-4.5 w-4.5 text-sky" /> Coming up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.upcoming.map((r) => (
                <RevisionRow key={r.id} item={r} busy={busy === r.id} onMark={mark} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RevisionRow({ item, busy, onMark }: { item: RevisionItem; busy: boolean; onMark: (i: RevisionItem, a: "revised" | "again") => void }) {
  const isDue = item.dueToday || item.overdue;
  return (
    <div className={cn("flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border p-3", isDue ? (item.overdue ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30" : "bg-mint-soft/40 border-mint/30") : "bg-card")}>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{item.topicTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{item.subject}</span>
          <span>·</span>
          <span>Revision {item.stage + 1}/{item.totalStages}</span>
          <span>·</span>
          <span>{item.overdue ? `overdue since ${item.dueDate}` : item.dueToday ? "due today" : `in ${item.daysAway} day${item.daysAway === 1 ? "" : "s"}`}</span>
          {item.weak ? <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200 border-0 rounded-full text-[10px]"><Flame className="h-2.5 w-2.5 mr-0.5" /> weak topic</Badge> : null}
        </p>
        {/* ladder dots */}
        <div className="flex items-center gap-1 mt-1.5">
          {item.intervals.map((d, i) => (
            <span key={i} className={cn("h-1.5 w-7 rounded-full", i < item.stage ? "bg-mint" : "bg-muted")} title={`+${d} day${d > 1 ? "s" : ""}`} />
          ))}
        </div>
      </div>
      {isDue ? (
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" className="rounded-full h-8" disabled={busy} onClick={() => onMark(item, "revised")}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Revised
          </Button>
          <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => onMark(item, "again")}>
            <RotateCcw className="h-4 w-4 mr-1" /> Need practice
          </Button>
        </div>
      ) : (
        <Badge variant="outline" className="rounded-full shrink-0">scheduled</Badge>
      )}
    </div>
  );
}
