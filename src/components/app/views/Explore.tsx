"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Compass, Bookmark, BookmarkCheck, ExternalLink, Globe, Sparkles } from "lucide-react";

type Course = {
  id: string;
  title: string;
  platform: string;
  url: string;
  category: string;
  level: string;
  pricing: string;
  pricingLabel: string;
  description: string;
  bookmarked: boolean;
  progress: number;
};
type Platform = { name: string; url: string; note: string };

const PRICING_STYLE: Record<string, string> = {
  FREE: "bg-mint-soft text-teal-800 dark:text-teal-100",
  FREE_AUDIT: "bg-sky-soft text-sky-900 dark:text-sky-100",
  PAID: "bg-peach-soft text-orange-900 dark:text-orange-100",
  FREEMIUM: "bg-lavender-soft text-violet-900 dark:text-violet-100",
};

export function ExploreView() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api<{ courses: Course[]; platforms: Platform[] }>("/api/courses")
      .then((r) => {
        setCourses(r.courses);
        setPlatforms(r.platforms);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load courses."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const categories = useMemo(() => ["All", ...(courses ? [...new Set(courses.map((c) => c.category))] : [])], [courses]);
  const filtered = (courses ?? []).filter((c) => (category === "All" || c.category === category) && (!onlyBookmarked || c.bookmarked));

  async function toggleBookmark(course: Course) {
    setBusy(course.id);
    try {
      const r = await api<{ bookmarked: boolean }>("/api/bookmarks", { method: "POST", body: { courseId: course.id } });
      toast({ title: r.bookmarked ? "Bookmarked 🔖" : "Bookmark removed" });
      load();
    } catch (e) {
      toast({ title: "Could not update bookmark", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function setProgress(course: Course, progress: number) {
    setBusy(course.id);
    try {
      await api("/api/bookmarks", { method: "PATCH", body: { courseId: course.id, progress } });
      load();
    } catch (e) {
      toast({ title: "Bookmark the course first to track progress", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Card className="rounded-xl"><CardContent className="pt-5 text-sm text-rose-600">{error}</CardContent></Card>;
  if (!courses)
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />)}</div>
      </div>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Explore Courses"
        subtitle="Genuine, curated courses beyond your syllabus — free & paid, clearly labelled."
        icon={<Compass className="h-5 w-5" />}
        action={
          <Button variant={onlyBookmarked ? "default" : "outline"} className="rounded-full" onClick={() => setOnlyBookmarked((v) => !v)}>
            {onlyBookmarked ? <BookmarkCheck className="h-4 w-4 mr-1.5" /> : <Bookmark className="h-4 w-4 mr-1.5" />}
            {onlyBookmarked ? "Showing bookmarks" : "My bookmarks"}
          </Button>
        }
      />

      <Card className="rounded-xl">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-mint shrink-0" />
            <p className="text-sm font-bold mr-2">Recommended platforms:</p>
            {platforms.map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" title={p.note}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold hover:border-mint hover:text-mint transition-colors">
                <Globe className="h-3 w-3" /> {p.name} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(c)}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors", category === c ? "bg-mint text-white border-mint" : "bg-card text-muted-foreground hover:border-mint")}
            aria-pressed={category === c}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <Card key={c.id} className="rounded-xl card-hover flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-extrabold leading-snug">{c.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{c.platform} · {c.level}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy === c.id} onClick={() => toggleBookmark(c)} aria-label={c.bookmarked ? "Remove bookmark" : "Bookmark course"}>
                  <Bookmark className={cn("h-4 w-4", c.bookmarked && "fill-peach text-peach")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-full text-[10px]">{c.category}</Badge>
                <Badge className={cn("rounded-full text-[10px] border-0", PRICING_STYLE[c.pricing])}>{c.pricingLabel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
              {c.bookmarked ? (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">Progress</span>
                    <span className="text-muted-foreground">{c.progress}%</span>
                  </div>
                  <Progress value={c.progress} className="h-2" />
                  <div className="flex gap-1.5 mt-2">
                    {[0, 25, 50, 75, 100].map((p) => (
                      <button key={p} type="button" onClick={() => setProgress(c, p)}
                        className={cn("text-[10px] font-bold rounded-full border px-2 py-0.5", c.progress === p ? "bg-mint text-white border-mint" : "hover:border-mint")}>
                        {p === 100 ? "Done" : p === 0 ? "Reset" : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-mint inline-flex items-center gap-1 hover:underline">
                Open course <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">{onlyBookmarked ? "No bookmarks yet — tap the bookmark icon on any course." : "No courses in this category yet."}</p>
      ) : null}
    </div>
  );
}
