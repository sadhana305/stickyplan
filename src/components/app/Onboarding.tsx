"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BRAND } from "@/components/app/brand";
import { ChevronLeft, GraduationCap, Plus, Trash2, CalendarDays, Clock3, ListChecks, Sparkles, BookOpen } from "lucide-react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type SubjectRow = { name: string; examDate: string };

export function Onboarding() {
  const { user, setUser } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [educationLevel, setEducationLevel] = useState("Undergraduate");
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([{ name: "", examDate: "" }]);
  const [hours, setHours] = useState(2);
  const [studyDays, setStudyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeSlots, setTimeSlots] = useState("");
  const [limits, setLimits] = useState<Record<number, number>>({ 0: 0, 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 4 });
  const [planningMode, setPlanningMode] = useState("BALANCED");
  const [learningPrefs, setLearningPrefs] = useState("");

  const steps = useMemo(
    () => [
      { title: "Nice to meet you!", icon: <GraduationCap className="h-5 w-5" /> },
      { title: "Your course", icon: <BookOpen className="h-5 w-5" /> },
      { title: "Subjects & exams", icon: <CalendarDays className="h-5 w-5" /> },
      { title: "Your study time", icon: <Clock3 className="h-5 w-5" /> },
      { title: "Daily topic limit", icon: <ListChecks className="h-5 w-5" /> },
      { title: "How you like to learn", icon: <Sparkles className="h-5 w-5" /> },
    ],
    []
  );

  const toggleDay = (d: number) =>
    setStudyDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()));

  async function finish() {
    setBusy(true);
    try {
      await api("/api/onboarding", {
        method: "POST",
        body: {
          educationLevel,
          course,
          semester,
          studyHoursPerDay: hours,
          studyDays: studyDays.join(","),
          weekdayLimits: Object.fromEntries(
            Array.from({ length: 7 }, (_, d) => [d, studyDays.includes(d) ? limits[d] ?? 1 : 0])
          ),
          timeSlots,
          dailyTopicLimit: Math.max(...studyDays.map((d) => limits[d] ?? 1), 1),
          learningPrefs,
          planningMode,
          subjects: subjects.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), examDate: s.examDate || undefined })),
        },
      });
      setUser(user ? { ...user, onboardingDone: true } : null);
      toast({ title: "You're all set! 🎉", description: "Next: add your full syllabus so your plan can shine." });
    } catch (err) {
      toast({ title: "Could not save onboarding", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const valid =
    step === 0 ? true
    : step === 1 ? course.trim().length > 0
    : step === 2 ? subjects.some((s) => s.name.trim())
    : step === 3 ? studyDays.length > 0
    : step === 4 ? studyDays.some((d) => (limits[d] ?? 0) > 0)
    : true;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-4 h-16 flex items-center justify-between">
          <BRAND />
          <span className="text-sm font-semibold text-muted-foreground">
            Step {step + 1} of {steps.length}
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-10">
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-mint to-sky rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="soft-card p-6 sm:p-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-mint-soft text-teal-700 dark:text-teal-200 flex items-center justify-center">{steps[step].icon}</div>
            <h1 className="text-2xl font-extrabold tracking-tight">{steps[step].title}</h1>
          </div>

          <div className="mt-6 space-y-5">
            {step === 0 ? (
              <>
                <div className="space-y-1.5">
                  <Label>Your name</Label>
                  <Input value={user?.name ?? ""} disabled />
                  <p className="text-xs text-muted-foreground">You can change this later in Settings.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Education level</Label>
                  <Select value={educationLevel} onValueChange={setEducationLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["School (up to grade 10)", "Higher secondary (11-12)", "Undergraduate", "Postgraduate", "Diploma", "Other"].map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="space-y-1.5">
                  <Label>Course / degree</Label>
                  <Input placeholder="e.g. B.Tech Computer Science, B.Com, Class 12" value={course} onChange={(e) => setCourse(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Semester / year (optional)</Label>
                  <Input placeholder="e.g. Semester 3" value={semester} onChange={(e) => setSemester(e.target.value)} />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Add your main subjects and when their exams are (approximate is fine). You can import the full syllabus right after this.
                </p>
                {subjects.map((s, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder={`Subject ${i + 1} name`}
                      value={s.name}
                      onChange={(e) => setSubjects((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    />
                    <Input
                      type="date"
                      className="sm:w-44"
                      value={s.examDate}
                      onChange={(e) => setSubjects((rows) => rows.map((r, j) => (j === i ? { ...r, examDate: e.target.value } : r)))}
                      aria-label={`Exam date for subject ${i + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 self-center"
                      aria-label="Remove subject"
                      onClick={() => setSubjects((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : rows))}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSubjects((r) => [...r, { name: "", examDate: "" }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add subject
                </Button>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="space-y-1.5">
                  <Label>Study hours per day: <span className="font-extrabold text-foreground">{hours}h</span></Label>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-teal-600"
                    aria-label="Study hours per day"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Preferred study days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_FULL.map((full, d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-bold border transition-all",
                          studyDays.includes(d)
                            ? "bg-mint text-white border-mint shadow-sm"
                            : "bg-card text-muted-foreground hover:border-mint"
                        )}
                        aria-pressed={studyDays.includes(d)}
                      >
                        {DAY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred time of day (optional)</Label>
                  <Input placeholder="e.g. Early morning 5-7am, evening 6-9pm" value={timeSlots} onChange={(e) => setTimeSlots(e.target.value)} />
                </div>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  How many topics can you comfortably finish on each study day? Be honest — the planner respects your limits. You can set different limits for different days.
                </p>
                {studyDays.map((d) => (
                  <div key={d} className="flex items-center gap-4">
                    <span className="w-20 font-bold text-sm">{DAY_FULL[d]}</span>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      value={limits[d] ?? 1}
                      onChange={(e) => setLimits((l) => ({ ...l, [d]: Number(e.target.value) }))}
                      className="flex-1 accent-teal-600"
                      aria-label={`Topics per ${DAY_FULL[d]}`}
                    />
                    <span className="w-28 text-sm font-bold">{limits[d] ?? 1} topic{(limits[d] ?? 1) > 1 ? "s" : ""}</span>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Planning style</Label>
                  <Select value={planningMode} onValueChange={setPlanningMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed — never exceed my limit</SelectItem>
                      <SelectItem value="FLEXIBLE">Flexible — suggest extra topics near exams (I approve)</SelectItem>
                      <SelectItem value="BALANCED">Balanced — fit topics to my time & difficulty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <div className="space-y-1.5">
                  <Label>Learning preferences (optional)</Label>
                  <Textarea
                    rows={4}
                    placeholder="e.g. I like real-life examples, bullet-point notes, and analogies. Explain slowly for maths."
                    value={learningPrefs}
                    onChange={(e) => setLearningPrefs(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">The AI tutor and study materials will adapt to this.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="notify">Gentle reminder notifications</Label>
                    <p className="text-xs text-muted-foreground mt-1">Revisions due, exams approaching, streak milestones.</p>
                  </div>
                  <Switch id="notify" defaultChecked />
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button className="rounded-full px-6" disabled={!valid} onClick={() => setStep((s) => s + 1)}>
                Continue
              </Button>
            ) : (
              <Button className="rounded-full px-6" disabled={!valid || busy} onClick={finish}>
                {busy ? "Setting up…" : "Finish setup 🎉"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
