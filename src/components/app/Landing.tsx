"use client";

import { useState } from "react";
import { useApp, type AuthUser } from "@/lib/store";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { BRAND } from "@/components/app/brand";
import {
  CalendarDays,
  BookOpen,
  BrainCircuit,
  Flame,
  GraduationCap,
  LineChart,
  MessageCircleHeart,
  NotebookPen,
  PenLine,
  Repeat2,
  Youtube,
  Compass,
  ArrowRight,
  ChevronLeft,
  Leaf,
} from "lucide-react";

type Mode = "landing" | "login" | "register" | "forgot" | "reset";

const FEATURES = [
  { icon: <CalendarDays className="h-5 w-5" />, title: "AI Study Planner", text: "Personalised daily & weekly plans around your exam dates, energy and limits — fixed, flexible or balanced." },
  { icon: <BookOpen className="h-5 w-5" />, title: "Syllabus Manager", text: "Upload a PDF or snap photos of your syllabus. AI extracts subjects, chapters and topics for you to review." },
  { icon: <NotebookPen className="h-5 w-5" />, title: "AI Study Materials", text: "Simple & detailed explanations, definitions, examples, formulas, tables, summaries and flashcards." },
  { icon: <PenLine className="h-5 w-5" />, title: "Question Generator", text: "Exam-style questions by marks (1, 2, 5, 10, 13, 16+) with model answers and full practice papers." },
  { icon: <Flame className="h-5 w-5" />, title: "Daily Quiz & Streaks", text: "A fresh quiz from today's topics every day. Build gentle streaks with milestone celebrations." },
  { icon: <Repeat2 className="h-5 w-5" />, title: "Smart Revisions", text: "Spaced repetition after 1, 3, 7, 14 and 30 days — weak topics come back sooner, automatically." },
  { icon: <MessageCircleHeart className="h-5 w-5" />, title: "AI Personal Tutor", text: "Ask anything about your subjects. Step-by-step help that knows your syllabus and weak spots." },
  { icon: <LineChart className="h-5 w-5" />, title: "Performance Analytics", text: "Beautiful charts for progress, accuracy, study time and weekly activity — with honest AI advice." },
  { icon: <Youtube className="h-5 w-5" />, title: "YouTube Learning", text: "Real educational videos for your topics via the official YouTube API — no invented links." },
  { icon: <Compass className="h-5 w-5" />, title: "Explore Courses", text: "Genuine free & paid courses from Coursera, edX, freeCodeCamp, SWAYAM, NPTEL, Khan Academy and more." },
];

export function Landing() {
  const [mode, setMode] = useState<Mode>("landing");
  const setUser = useApp((s) => s.setUser);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <BRAND />
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {mode === "landing" ? (
              <>
                <Button variant="ghost" onClick={() => setMode("login")}>Log in</Button>
                <Button onClick={() => setMode("register")} className="rounded-full">
                  Get started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setMode("landing")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {mode === "landing" ? (
          <LandingHero onGetStarted={() => setMode("register")} onLogin={() => setMode("login")} />
        ) : (
          <div className="mx-auto max-w-md w-full px-4 py-12 animate-fade-up">
            <AuthCard mode={mode} setMode={setMode} onSuccess={(u) => setUser(u)} />
          </div>
        )}
      </main>

      <footer className="border-t mt-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4 text-mint" /> STICKY PLAN — Your Personal AI Study Companion
          </p>
          <p>Made with care for students. Study at your own pace. 🌱</p>
        </div>
      </footer>
    </div>
  );
}

function LandingHero({ onGetStarted, onLogin }: { onGetStarted: () => void; onLogin: () => void }) {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pastel-blob w-96 h-96 bg-mint-soft -top-24 -left-24" />
        <div className="pastel-blob w-80 h-80 bg-lavender-soft top-10 right-0" />
        <div className="pastel-blob w-72 h-72 bg-peach-soft bottom-0 left-1/3" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-200 shadow-sm animate-fade-up">
            <BrainCircuit className="h-4 w-4" /> AI that plans, explains, quizzes & revises with you
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] animate-fade-up">
            Study smarter, calmer and <span className="brand-gradient">right on plan</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-up">
            STICKY PLAN turns your syllabus into a gentle day-by-day plan, explains difficult topics, generates exam-style
            questions, and helps you stay consistent — at your own pace.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up">
            <Button size="lg" className="rounded-full h-12 px-7 text-base" onClick={onGetStarted}>
              Start free — build my plan <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-12 px-7 text-base" onClick={onLogin}>
              I already have an account
            </Button>
          </div>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-sm">
            {[
              { v: "3 modes", l: "Fixed • Flexible • Balanced" },
              { v: "1→30 days", l: "Spaced revision ladder" },
              { v: "1–16+ marks", l: "Exam-style questions" },
              { v: "100-day", l: "Streak milestones" },
            ].map((s) => (
              <div key={s.v} className="soft-card p-4 card-hover">
                <p className="font-extrabold text-lg brand-gradient">{s.v}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center tracking-tight">Everything a student needs, in one calm place</h2>
        <p className="text-center text-muted-foreground mt-2 max-w-xl mx-auto">
          No clutter, no guilt — just the tools that quietly keep you moving forward.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="soft-card card-hover p-5">
              <div className="h-10 w-10 rounded-xl bg-mint-soft text-teal-700 dark:text-teal-200 flex items-center justify-center">{f.icon}</div>
              <h3 className="font-bold mt-3">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center tracking-tight">How it works</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            { n: "1", t: "Tell us about you", d: "Your course, subjects, exam dates and how much time you honestly have." },
            { n: "2", t: "Add your syllabus", d: "Upload a PDF or photos — AI extracts subjects, chapters and topics for you to review." },
            { n: "3", t: "Follow your plan", d: "Study today's topics, take the daily quiz, and let revisions keep memory fresh." },
          ].map((s) => (
            <div key={s.n} className="soft-card p-6 relative overflow-hidden card-hover">
              <span className="absolute -top-3 -right-1 text-7xl font-extrabold text-mint-soft select-none">{s.n}</span>
              <h3 className="font-bold text-lg relative">{s.t}</h3>
              <p className="text-sm text-muted-foreground mt-2 relative leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Button size="lg" className="rounded-full h-12 px-8 text-base" onClick={onGetStarted}>
            Create my free account <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>
    </>
  );
}

function AuthCard({
  mode,
  setMode,
  onSuccess,
}: {
  mode: Exclude<Mode, "landing">;
  setMode: (m: Mode) => void;
  onSuccess: (u: AuthUser) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", code: "" });
  const [resetHint, setResetHint] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await api<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
        onSuccess(r.user);
        toast({ title: `Welcome back, ${r.user.name}! 🌿` });
      } else if (mode === "register") {
        const r = await api<{ user: AuthUser }>("/api/auth/register", {
          method: "POST",
          body: { name: form.name, email: form.email, password: form.password, confirmPassword: form.confirm },
        });
        onSuccess(r.user);
        toast({ title: "Account created! Let's set up your plan. 🎉" });
      } else if (mode === "forgot") {
        const r = await api<{ message: string; devCode: string | null }>("/api/auth/forgot", { method: "POST", body: { email: form.email } });
        setResetHint(r.devCode ?? r.message);
      } else if (mode === "reset") {
        const r = await api<{ message: string }>("/api/auth/reset", {
          method: "POST",
          body: { code: form.code, password: form.password, confirmPassword: form.confirm },
        });
        toast({ title: r.message });
        setMode("login");
      }
    } catch (err) {
      toast({ title: "Hmm, something went wrong", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, string> = {
    landing: "",
    login: "Welcome back",
    register: "Create your account",
    forgot: "Forgot your password?",
    reset: "Set a new password",
  };

  return (
    <div className="soft-card p-6 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight">{titles[mode]}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {mode === "login" && "Log in to pick up right where you left off."}
        {mode === "register" && "Free forever for students. No credit card needed."}
        {mode === "forgot" && "Enter your account email and we'll generate a reset code."}
        {mode === "reset" && "Paste the reset code you received and choose a new password."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" placeholder="Asha Verma" value={form.name} onChange={set("name")} required maxLength={80} />
          </div>
        ) : null}

        {mode === "login" || mode === "register" || mode === "forgot" ? (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@school.edu" value={form.email} onChange={set("email")} required />
          </div>
        ) : null}

        {mode === "reset" ? (
          <div className="space-y-1.5">
            <Label htmlFor="code">Reset code</Label>
            <Input id="code" placeholder="AB12CD34EF56" value={form.code} onChange={set("code")} required />
          </div>
        ) : null}

        {mode === "login" || mode === "register" || mode === "reset" ? (
          <div className="space-y-1.5">
            <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
            <Input id="password" type="password" placeholder={mode === "login" ? "Your password" : "At least 8 characters"} value={form.password} onChange={set("password")} required minLength={mode === "login" ? 1 : 8} />
          </div>
        ) : null}

        {mode === "register" || mode === "reset" ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={form.confirm} onChange={set("confirm")} required minLength={8} />
          </div>
        ) : null}

        <Button type="submit" className="w-full rounded-full h-11" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "register" ? "Create account" : mode === "forgot" ? "Get reset code" : "Update password"}
        </Button>
      </form>

      {resetHint ? (
        <div className="mt-4 rounded-lg border border-mint/40 bg-mint-soft p-3 text-sm">
          <p className="font-semibold text-teal-900 dark:text-teal-100">Reset code</p>
          <p className="mt-1 text-teal-900/80 dark:text-teal-200/90">{resetHint}</p>
          <Button size="sm" className="mt-3 rounded-full" onClick={() => setMode("reset")}>
            Continue to new password
          </Button>
        </div>
      ) : null}

      <div className="mt-6 text-sm text-muted-foreground space-y-2">
        {mode === "login" ? (
          <>
            <p>
              New here?{" "}
              <button type="button" className="font-bold text-teal-700 dark:text-teal-300 hover:underline" onClick={() => setMode("register")}>
                Create an account
              </button>
            </p>
            <p>
              <button type="button" className="hover:underline" onClick={() => setMode("forgot")}>
                Forgot your password?
              </button>
            </p>
          </>
        ) : null}
        {mode === "register" ? (
          <p>
            Already have an account?{" "}
            <button type="button" className="font-bold text-teal-700 dark:text-teal-300 hover:underline" onClick={() => setMode("login")}>
              Log in
            </button>
          </p>
        ) : null}
        {mode === "forgot" || mode === "reset" ? (
          <p>
            <button type="button" className="hover:underline" onClick={() => setMode("login")}>
              ← Back to login
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
