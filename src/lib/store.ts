"use client";

import { create } from "zustand";

export type ViewName =
  | "dashboard"
  | "planner"
  | "subjects"
  | "syllabus"
  | "materials"
  | "questions"
  | "quiz"
  | "streaks"
  | "youtube"
  | "explore"
  | "tutor"
  | "revision"
  | "analytics"
  | "notifications"
  | "settings";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  onboardingDone: boolean;
};

type AppState = {
  booted: boolean;
  user: AuthUser | null;
  view: ViewName;
  sidebarOpen: boolean;
  unread: number;
  setBooted: (v: boolean) => void;
  setUser: (u: AuthUser | null) => void;
  setView: (v: ViewName) => void;
  setSidebarOpen: (v: boolean) => void;
  setUnread: (n: number) => void;
};

export const useApp = create<AppState>((set) => ({
  booted: false,
  user: null,
  view: "dashboard",
  sidebarOpen: false,
  unread: 0,
  setBooted: (v) => set({ booted: v }),
  setUser: (u) => set({ user: u }),
  setView: (v) => set({ view: v, sidebarOpen: false }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setUnread: (n) => set({ unread: n }),
}));
