"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { api } from "@/lib/client";
import { Landing } from "@/components/app/Landing";
import { Onboarding } from "@/components/app/Onboarding";
import { Shell } from "@/components/app/Shell";
import { Dashboard } from "@/components/app/views/Dashboard";
import { PlannerView } from "@/components/app/views/Planner";
import { SubjectsView } from "@/components/app/views/Subjects";
import { SyllabusView } from "@/components/app/views/Syllabus";
import { MaterialsView } from "@/components/app/views/Materials";
import { QuestionGenView } from "@/components/app/views/Questions";
import { QuizView } from "@/components/app/views/Quiz";
import { StreakView } from "@/components/app/views/Streaks";
import { YouTubeView } from "@/components/app/views/YouTube";
import { ExploreView } from "@/components/app/views/Explore";
import { TutorView } from "@/components/app/views/Tutor";
import { RevisionView } from "@/components/app/views/Revision";
import { AnalyticsView } from "@/components/app/views/Analytics";
import { NotificationsView } from "@/components/app/views/Notifications";
import { SettingsView } from "@/components/app/views/Settings";
import { GraduationCap } from "lucide-react";

export function App() {
  const { booted, user, view, setBooted, setUser } = useApp();

  useEffect(() => {
    let alive = true;
    api<{ user: null | { id: string; name: string; email: string; onboardingDone: boolean } }>("/api/auth/me")
      .then((r) => {
        if (!alive) return;
        setUser(r.user);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setBooted(true);
      });
    return () => {
      alive = false;
    };
  }, [setBooted, setUser]);

  if (!booted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white animate-pulse shadow-lg">
          <GraduationCap className="h-7 w-7" />
        </div>
        <p className="text-sm font-bold text-muted-foreground tracking-wide">STICKY PLAN</p>
      </div>
    );
  }

  if (!user) return <Landing />;
  if (!user.onboardingDone) return <Onboarding />;

  return (
    <Shell>
      {view === "dashboard" && <Dashboard />}
      {view === "planner" && <PlannerView />}
      {view === "subjects" && <SubjectsView />}
      {view === "syllabus" && <SyllabusView />}
      {view === "materials" && <MaterialsView />}
      {view === "questions" && <QuestionGenView />}
      {view === "quiz" && <QuizView />}
      {view === "streaks" && <StreakView />}
      {view === "youtube" && <YouTubeView />}
      {view === "explore" && <ExploreView />}
      {view === "tutor" && <TutorView />}
      {view === "revision" && <RevisionView />}
      {view === "analytics" && <AnalyticsView />}
      {view === "notifications" && <NotificationsView />}
      {view === "settings" && <SettingsView />}
    </Shell>
  );
}
