"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState, ErrorState } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Repeat2, CalendarX2, Flame, ListChecks, Sparkles, Info } from "lucide-react";

type Notification = { id: string; type: string; title: string; body: string | null; read: boolean; createdAt: string };

const ICONS: Record<string, React.ReactNode> = {
  revision: <Repeat2 className="h-4.5 w-4.5 text-lavender" />,
  exam: <CalendarX2 className="h-4.5 w-4.5 text-peach" />,
  streak: <Flame className="h-4.5 w-4.5 text-peach" />,
  quiz: <ListChecks className="h-4.5 w-4.5 text-mint" />,
  plan_ready: <Sparkles className="h-4.5 w-4.5 text-mint" />,
  system: <Info className="h-4.5 w-4.5 text-sky" />,
};

export function NotificationsView() {
  const setUnread = useApp((s) => s.setUnread);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ notifications: Notification[]; unread: number }>("/api/notifications")
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unread);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load notifications."));
  }, [setUnread]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function markAll() {
    try {
      await api("/api/notifications", { method: "POST", body: { action: "readAll" } });
      setUnread(0);
      load();
    } catch {
      /* ignore */
    }
  }

  async function markOne(n: Notification) {
    if (n.read) return;
    try {
      await api("/api/notifications", { method: "POST", body: { action: "read", id: n.id } });
      load();
    } catch {
      /* ignore */
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle="Revisions due, exams approaching, streak wins — gentle nudges only."
        icon={<Bell className="h-5 w-5" />}
        action={
          <Button variant="outline" className="rounded-full" onClick={markAll}><CheckCheck className="h-4 w-4 mr-1.5" /> Mark all read</Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="All quiet 🌿" description="You'll hear from us when a revision is due, an exam is close, or you hit a streak milestone." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={cn("rounded-xl cursor-pointer transition-all", n.read ? "opacity-60" : "border-mint/40 shadow-sm hover:shadow")}
              onClick={() => markOne(n)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && markOne(n)}
              aria-label={n.read ? n.title : `Mark read: ${n.title}`}
            >
              <CardContent className="flex items-start gap-3 py-4">
                <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">{ICONS[n.type] ?? ICONS.system}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{n.title}</p>
                    {!n.read ? <Badge className="bg-peach text-white border-0 rounded-full text-[9px]">new</Badge> : null}
                  </div>
                  {n.body ? <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p> : null}
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
