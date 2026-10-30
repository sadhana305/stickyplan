"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ErrorState } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Settings as SettingsIcon, User, Clock3, ListChecks, Lock, Sparkles, LogOut } from "lucide-react";

type Profile = {
  name: string;
  email: string;
  educationLevel: string | null;
  course: string | null;
  semester: string | null;
  studyHoursPerDay: number;
  studyDays: string;
  weekdayLimits: string;
  timeSlots: string | null;
  dailyTopicLimit: number;
  learningPrefs: string | null;
  planningMode: string;
};

const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsView() {
  const { toast } = useToast();
  const setUser = useApp((s) => s.setUser);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<number, number>>({});
  const [studyDays, setStudyDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const load = useCallback(() => {
    setError(null);
    api<{ profile: Profile }>("/api/profile")
      .then((r) => {
        setProfile(r.profile);
        try {
          setLimits(JSON.parse(r.profile.weekdayLimits) as Record<number, number>);
        } catch {
          setLimits({ 0: 0, 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 4 });
        }
        setStudyDays(r.profile.studyDays.split(",").map(Number).filter((n) => !isNaN(n)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load settings."));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: {
          name: profile.name,
          educationLevel: profile.educationLevel,
          course: profile.course,
          semester: profile.semester,
          studyHoursPerDay: profile.studyHoursPerDay,
          studyDays: studyDays.join(","),
          weekdayLimits: Object.fromEntries(
            Array.from({ length: 7 }, (_, d) => [d, studyDays.includes(d) ? limits[d] ?? 1 : 0])
          ),
          timeSlots: profile.timeSlots ?? "",
          dailyTopicLimit: profile.dailyTopicLimit,
          learningPrefs: profile.learningPrefs ?? "",
          planningMode: profile.planningMode,
        },
      });
      const me = await api<{ user: { id: string; name: string; email: string; onboardingDone: boolean } }>("/api/auth/me");
      setUser(me.user);
      toast({ title: "Settings saved ✅", description: "Regenerate your plan to apply any schedule changes." });
      load();
    } catch (e) {
      toast({ title: "Could not save settings", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    try {
      const r = await api<{ message: string }>("/api/password", {
        method: "POST",
        body: { currentPassword: pw.current, newPassword: pw.next, confirmPassword: pw.confirm },
      });
      toast({ title: r.message });
      setPw({ current: "", next: "", confirm: "" });
    } catch (e) {
      toast({ title: "Could not change password", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch {
      /* ignore */
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader title="Settings" subtitle="Your profile, study preferences and account." icon={<SettingsIcon className="h-5 w-5" />} />

      {/* Profile */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3"><CardTitle className="text-base font-extrabold flex items-center gap-2"><User className="h-4.5 w-4.5 text-mint" /> Profile</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={profile.email} disabled /></div>
          <div className="space-y-1.5"><Label>Education level</Label>
            <Select value={profile.educationLevel ?? "Undergraduate"} onValueChange={(v) => setProfile({ ...profile, educationLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["School (up to grade 10)", "Higher secondary (11-12)", "Undergraduate", "Postgraduate", "Diploma", "Other"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Course</Label><Input value={profile.course ?? ""} onChange={(e) => setProfile({ ...profile, course: e.target.value })} placeholder="e.g. B.Tech CSE" /></div>
          <div className="space-y-1.5"><Label>Semester</Label><Input value={profile.semester ?? ""} onChange={(e) => setProfile({ ...profile, semester: e.target.value })} placeholder="e.g. Semester 3" /></div>
        </CardContent>
      </Card>

      {/* Study preferences */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3"><CardTitle className="text-base font-extrabold flex items-center gap-2"><Clock3 className="h-4.5 w-4.5 text-sky" /> Study preferences</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Study hours per day: <b>{profile.studyHoursPerDay}h</b></Label>
            <input type="range" min={0.5} max={12} step={0.5} value={profile.studyHoursPerDay} onChange={(e) => setProfile({ ...profile, studyHoursPerDay: Number(e.target.value) })} className="w-full accent-teal-600" aria-label="Study hours per day" />
          </div>
          <div>
            <Label className="mb-2 block">Study days</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_FULL.map((full, d) => (
                <button key={d} type="button"
                  onClick={() => setStudyDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()))}
                  className={cn("px-4 py-2 rounded-full text-sm font-bold border transition-all", studyDays.includes(d) ? "bg-mint text-white border-mint" : "bg-card text-muted-foreground hover:border-mint")}
                  aria-pressed={studyDays.includes(d)}>
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Topics per study day</Label>
            {studyDays.map((d) => (
              <div key={d} className="flex items-center gap-3">
                <span className="w-20 text-sm font-bold">{DAY_FULL[d]}</span>
                <input type="range" min={1} max={8} value={limits[d] ?? 1} onChange={(e) => setLimits((l) => ({ ...l, [d]: Number(e.target.value) }))} className="flex-1 accent-teal-600" aria-label={`Topics on ${DAY_FULL[d]}`} />
                <span className="w-16 text-sm font-bold text-right">{limits[d] ?? 1}</span>
              </div>
            ))}
            {studyDays.length === 0 ? <p className="text-xs text-rose-500">Pick at least one study day.</p> : null}
          </div>
          <div className="space-y-1.5"><Label>Preferred time of day</Label><Input value={profile.timeSlots ?? ""} onChange={(e) => setProfile({ ...profile, timeSlots: e.target.value })} placeholder="e.g. mornings 6-8am" /></div>
          <div className="space-y-1.5">
            <Label>Default planning mode</Label>
            <Select value={profile.planningMode} onValueChange={(v) => setProfile({ ...profile, planningMode: v })}>
              <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Fixed — never exceed limits</SelectItem>
                <SelectItem value="FLEXIBLE">Flexible — suggest extras near exams</SelectItem>
                <SelectItem value="BALANCED">Balanced — adapt to time & difficulty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Learning preferences */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3"><CardTitle className="text-base font-extrabold flex items-center gap-2"><Sparkles className="h-4.5 w-4.5 text-lavender" /> Learning preferences</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={3} value={profile.learningPrefs ?? ""} onChange={(e) => setProfile({ ...profile, learningPrefs: e.target.value })} placeholder="How do you like to learn? Examples, analogies, slow pacing for maths…" />
          <div className="space-y-1.5 max-w-xs">
            <Label>Default daily topic limit</Label>
            <Select value={String(profile.dailyTopicLimit)} onValueChange={(v) => setProfile({ ...profile, dailyTopicLimit: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>{n} topic{n > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button className="rounded-full px-8" onClick={save} disabled={saving || studyDays.length === 0}>
        {saving ? "Saving…" : "Save settings"}
      </Button>

      {/* Security */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3"><CardTitle className="text-base font-extrabold flex items-center gap-2"><Lock className="h-4.5 w-4.5 text-peach" /> Change password</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-w-sm">
          <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Confirm new password</Label><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          <Button variant="outline" className="rounded-full" onClick={changePassword} disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.confirm}>
            Update password
          </Button>
        </CardContent>
      </Card>

      {/* About integrations */}
      <Card className="rounded-xl border-dashed">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">About integrations</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p><b className="text-foreground">AI features</b> run through a secure server-side SDK — no API keys are ever exposed to your browser.</p>
          <p><b className="text-foreground">YouTube search</b> activates automatically when a <code className="bg-muted px-1 rounded">YOUTUBE_API_KEY</code> environment variable is configured; until then it shows an honest setup message instead of fake videos.</p>
          <p><b className="text-foreground">Your data</b> is stored privately in your account — every API request is scoped to your session.</p>
        </CardContent>
      </Card>

      <Button variant="destructive" className="rounded-full" onClick={logout}><LogOut className="h-4 w-4 mr-1.5" /> Log out</Button>
    </div>
  );
}
