"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useApp, type ViewName } from "@/lib/store";
import { api } from "@/lib/client";
import { BRAND } from "@/components/app/brand";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  FolderTree,
  NotebookPen,
  LibraryBig,
  PenLine,
  FileQuestion,
  ListChecks,
  Flame,
  Youtube,
  Compass,
  MessageCircleHeart,
  Repeat2,
  LineChart,
  Bell,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
} from "lucide-react";

const NAV: { id: ViewName; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
  { id: "planner", label: "Study Planner", icon: <CalendarDays className="h-4.5 w-4.5" /> },
  { id: "subjects", label: "My Subjects", icon: <BookOpen className="h-4.5 w-4.5" /> },
  { id: "syllabus", label: "Syllabus", icon: <FolderTree className="h-4.5 w-4.5" /> },
  { id: "materials", label: "Study Materials", icon: <NotebookPen className="h-4.5 w-4.5" /> },
  { id: "library", label: "My Study Library", icon: <LibraryBig className="h-4.5 w-4.5" /> },
  { id: "questions", label: "Question Generator", icon: <PenLine className="h-4.5 w-4.5" /> },
  { id: "qbank", label: "My Q&A Bank", icon: <FileQuestion className="h-4.5 w-4.5" /> },
  { id: "quiz", label: "Daily Quiz", icon: <ListChecks className="h-4.5 w-4.5" /> },
  { id: "streaks", label: "Quiz Streaks", icon: <Flame className="h-4.5 w-4.5" /> },
  { id: "youtube", label: "YouTube Learning", icon: <Youtube className="h-4.5 w-4.5" /> },
  { id: "revision", label: "Revision Centre", icon: <Repeat2 className="h-4.5 w-4.5" /> },
  { id: "explore", label: "Explore Courses", icon: <Compass className="h-4.5 w-4.5" /> },
  { id: "analytics", label: "Performance", icon: <LineChart className="h-4.5 w-4.5" /> },
  { id: "tutor", label: "AI Tutor", icon: <MessageCircleHeart className="h-4.5 w-4.5" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4.5 w-4.5" /> },
  { id: "settings", label: "Settings", icon: <Settings className="h-4.5 w-4.5" /> },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, view, setView, sidebarOpen, setSidebarOpen, unread, setUnread, setUser } = useApp();
  const { toast } = useToast();

  // Poll unread notifications lightly
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ unread: number }>("/api/notifications")
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [setUnread]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      toast({ title: "Logged out. See you soon! 🌿" });
    } catch {
      toast({ title: "Could not log out", variant: "destructive" });
    }
  }

  const navList = (
    <nav className="flex-1 overflow-y-auto scroll-soft px-3 py-3 space-y-0.5" aria-label="Main navigation">
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setView(item.id)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors text-left",
            view === item.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-accent-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          aria-current={view === item.id ? "page" : undefined}
        >
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.id === "notifications" && unread > 0 ? (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-peach text-white text-[11px] font-extrabold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );

  const brandBlock = (
    <div className="h-16 shrink-0 border-b border-sidebar-border px-5 flex items-center">
      <Link href="/" aria-label="STICKY PLAN home">
        <BRAND />
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        {brandBlock}
        {navList}
        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground">
          Study at your own pace. 🌱
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 h-16 border-b bg-background/85 backdrop-blur flex items-center gap-2 px-3 sm:px-5">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden rounded-full" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground flex flex-col">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="h-16 flex items-center px-4 border-b border-sidebar-border">{brandBlock}</div>
              {navList}
            </SheetContent>
          </Sheet>

          <div className="lg:hidden flex-1 min-w-0 truncate">
            <span className="font-extrabold brand-gradient text-base">STICKY PLAN</span>
          </div>
          <div className="hidden lg:block flex-1" />

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border bg-card pl-1.5 pr-2.5 py-1.5 hover:shadow-sm transition-shadow"
                aria-label="Account menu"
              >
                <span className="h-7 w-7 rounded-full bg-gradient-to-br from-mint to-lavender text-white text-xs font-extrabold flex items-center justify-center uppercase">
                  {(user?.name ?? "?").slice(0, 1)}
                </span>
                <span className="hidden sm:block text-sm font-bold max-w-28 truncate">{user?.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="font-bold">{user?.name}</p>
                <p className="text-xs font-normal text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView("settings")}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-rose-600 dark:text-rose-400">
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 px-3 sm:px-6 py-6 pb-16 w-full max-w-6xl mx-auto">{children}</main>

        <footer className="mt-auto border-t py-4 text-center text-xs text-muted-foreground">
          STICKY PLAN — Your Personal AI Study Companion · Made with 🌿 for students
        </footer>
      </div>
    </div>
  );
}
