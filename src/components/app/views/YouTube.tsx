"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { Youtube, Search, KeyRound, ExternalLink, GraduationCap, BookOpenCheck, Wrench, PlayCircle } from "lucide-react";

type Video = { videoId: string; title: string; channel: string; thumbnail: string | null; url: string; duration: string | null };

const CATEGORIES = [
  { id: "beginner", label: "Beginner explanation" },
  { id: "detailed", label: "Detailed learning" },
  { id: "revision", label: "Revision" },
  { id: "problems", label: "Problem-solving" },
];

export function YouTubeView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("detailed");
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    setApiError(null);
    try {
      const r = await api<{ configured: boolean; message?: string; videos?: Video[]; error?: string }>(
        `/api/youtube?q=${encodeURIComponent(q)}&category=${category}`
      );
      if (!r.configured) {
        setSetupMessage(r.message ?? "YouTube API key is not configured.");
        setVideos(null);
      } else if (r.error) {
        setApiError(r.error);
        setVideos(null);
      } else {
        setSetupMessage(null);
        setVideos(r.videos ?? []);
      }
    } catch (e) {
      toast({ title: "Search failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="YouTube Learning" subtitle="Real educational videos for your topics — via the official YouTube Data API." icon={<Youtube className="h-5 w-5" />} />

      <Card className="rounded-xl">
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Search a topic, e.g. pointers in C, photosynthesis, integration by parts…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button className="rounded-full shrink-0" onClick={search} disabled={loading || !q.trim()}>
              <Search className="h-4 w-4 mr-1.5" /> Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${category === c.id ? "bg-mint text-white border-mint" : "bg-card text-muted-foreground hover:border-mint"}`}
                aria-pressed={category === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
          {loading ? <AIRunning label="Searching YouTube…" /> : null}
        </CardContent>
      </Card>

      {setupMessage ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-lemon-soft flex items-center justify-center text-yellow-700 dark:text-yellow-200"><KeyRound className="h-6 w-6" /></div>
            <p className="font-bold">YouTube API key needed</p>
            <p className="text-sm text-muted-foreground max-w-lg">{setupMessage}</p>
            <p className="text-xs text-muted-foreground max-w-md mt-1">
              This app never shows invented or fake videos — until a real key is configured, this feature stays offline by design.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {apiError ? (
        <Card className="rounded-xl border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardContent className="pt-4 text-sm text-rose-800 dark:text-rose-200">{apiError}</CardContent>
        </Card>
      ) : null}

      {videos && videos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No videos found for that search. Try different wording.</p>
      ) : null}

      {videos && videos.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <a key={v.videoId} href={v.url} target="_blank" rel="noopener noreferrer" className="soft-card card-hover overflow-hidden group">
              <div className="relative aspect-video bg-muted">
                {v.thumbnail ? (
                                    <img src={v.thumbnail} alt={`Thumbnail for ${v.title}`} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><PlayCircle className="h-10 w-10 text-muted-foreground" /></div>
                )}
                {v.duration ? <Badge className="absolute bottom-2 right-2 bg-black/80 text-white border-0 rounded text-[10px]">{v.duration}</Badge> : null}
              </div>
              <div className="p-3">
                <p className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-mint transition-colors">{v.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{v.channel}</p>
                <p className="text-xs text-mint font-bold mt-2 flex items-center gap-1">Watch on YouTube <ExternalLink className="h-3 w-3" /></p>
              </div>
            </a>
          ))}
        </div>
      ) : null}

      {!videos && !setupMessage && !apiError && !loading ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold flex items-center gap-2"><GraduationCap className="h-4.5 w-4.5 text-mint" /> How it works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p className="flex gap-2"><BookOpenCheck className="h-4 w-4 shrink-0 text-mint" /> Search any topic from your syllabus and pick a learning style — beginner, detailed, revision or problem-solving.</p>
            <p className="flex gap-2"><Wrench className="h-4 w-4 shrink-0 text-mint" /> Results come straight from the official YouTube Data API v3 — real titles, real channels, real links.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
