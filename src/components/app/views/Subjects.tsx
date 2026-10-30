"use client";

import { useCallback, useEffect, useState } from "react";
import { api, subjectColor } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ErrorState } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { daysBetween, todayStr } from "@/lib/dates";
import {
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  CalendarX2,
  FolderTree,
  CheckCircle2,
  Layers,
} from "lucide-react";

type Subject = {
  id: string;
  name: string;
  semester: string | null;
  color: string;
  chapters: { id: string; name: string; topics: { id: string; status: string }[] }[];
};

type Exam = { id: string; title: string; date: string; subjectId: string | null; subject?: { name: string } | null };

const COLOR_KEYS = ["mint", "lavender", "peach", "sky", "lemon", "rose"];

export function SubjectsView() {
  const { setView } = useApp();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: "", semester: "", color: "mint" });
  const [examOpen, setExamOpen] = useState(false);
  const [newExam, setNewExam] = useState({ title: "", date: "", subjectId: "none" });
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([api<{ subjects: Subject[] }>("/api/subjects"), api<{ exams: Exam[] }>("/api/exams")])
      .then(([s, e]) => {
        setSubjects(s.subjects);
        setExams(e.exams);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load subjects."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function addSubject() {
    try {
      await api("/api/subjects", { method: "POST", body: newSubject });
      toast({ title: "Subject added 📚" });
      setAddOpen(false);
      setNewSubject({ name: "", semester: "", color: COLOR_KEYS[subjects?.length ? subjects.length % COLOR_KEYS.length : 0] });
      load();
    } catch (e) {
      toast({ title: "Could not add subject", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function saveEdit() {
    if (!editSubject) return;
    try {
      await api("/api/subjects", { method: "PATCH", body: { id: editSubject.id, name: editSubject.name, semester: editSubject.semester ?? "", color: editSubject.color } });
      toast({ title: "Subject updated" });
      setEditSubject(null);
      load();
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function removeSubject(s: Subject) {
    if (!confirm(`Delete "${s.name}" with all its chapters, topics and progress? This cannot be undone.`)) return;
    try {
      await api(`/api/subjects?id=${s.id}`, { method: "DELETE" });
      toast({ title: "Subject deleted" });
      load();
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addExam() {
    try {
      await api("/api/exams", {
        method: "POST",
        body: { title: newExam.title, date: newExam.date, subjectId: newExam.subjectId === "none" ? null : newExam.subjectId },
      });
      toast({ title: "Exam scheduled 🗓️" });
      setExamOpen(false);
      setNewExam({ title: "", date: "", subjectId: "none" });
      load();
    } catch (e) {
      toast({ title: "Could not add exam", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function removeExam(exam: Exam) {
    try {
      await api(`/api/exams?id=${exam.id}`, { method: "DELETE" });
      load();
    } catch {
      /* ignore */
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!subjects) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Subjects"
        subtitle="Your subjects at a glance — progress, chapters and exams."
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Dialog open={examOpen} onOpenChange={setExamOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full"><CalendarX2 className="h-4 w-4 mr-1.5" /> Add exam</Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl">
                <DialogHeader><DialogTitle>Schedule an exam</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5"><Label>Exam title</Label>
                    <Input placeholder="e.g. DS Midterm" value={newExam.title} onChange={(e) => setNewExam((f) => ({ ...f, title: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Subject (optional)</Label>
                    <Select value={newExam.subjectId} onValueChange={(v) => setNewExam((f) => ({ ...f, subjectId: v }))}>
                      <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General (no specific subject)</SelectItem>
                        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select></div>
                  <div className="space-y-1.5"><Label>Date</Label>
                    <Input type="date" value={newExam.date} onChange={(e) => setNewExam((f) => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <Button className="rounded-full" onClick={addExam} disabled={!newExam.title.trim() || !newExam.date}>Save exam</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full"><Plus className="h-4 w-4 mr-1.5" /> Add subject</Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl">
                <DialogHeader><DialogTitle>New subject</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5"><Label>Name</Label>
                    <Input placeholder="e.g. Operating Systems" value={newSubject.name} onChange={(e) => setNewSubject((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Semester (optional)</Label>
                    <Input placeholder="e.g. Semester 4" value={newSubject.semester} onChange={(e) => setNewSubject((f) => ({ ...f, semester: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Colour</Label>
                    <div className="flex gap-2">
                      {COLOR_KEYS.map((c) => (
                        <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setNewSubject((f) => ({ ...f, color: c }))}
                          className={`h-8 w-8 rounded-full ${subjectColor(c).dot} ${newSubject.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} />
                      ))}
                    </div></div>
                </div>
                <DialogFooter>
                  <Button className="rounded-full" onClick={addSubject} disabled={!newSubject.name.trim()}>Add subject</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Exams strip */}
      {exams.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto scroll-soft pb-1">
          {exams.map((exam) => {
            const days = daysBetween(todayStr(), exam.date);
            return (
              <div key={exam.id} className="soft-card px-4 py-3 flex items-center gap-3 shrink-0">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-extrabold ${days <= 7 ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200" : "bg-mint-soft text-teal-800 dark:text-teal-100"}`}>
                  {days >= 0 ? `${days}d` : "–"}
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">{exam.subject?.name ?? "General"} · {exam.date}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete exam" onClick={() => removeExam(exam)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No subjects yet"
          description="Add your first subject, or import your whole syllabus at once — PDF, photos or pasted text."
          action={
            <div className="flex gap-2 justify-center">
              <Button className="rounded-full" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add subject</Button>
              <Button variant="outline" className="rounded-full" onClick={() => setView("syllabus")}><FolderTree className="h-4 w-4 mr-1.5" /> Import syllabus</Button>
            </div>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => {
            const topics = s.chapters.flatMap((c) => c.topics);
            const done = topics.filter((t) => t.status === "COMPLETED").length;
            const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;
            const c = subjectColor(s.color);
            const nextExam = exams.filter((e) => e.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <Card key={s.id} className="rounded-xl card-hover overflow-hidden">
                <div className={`h-1.5 w-full ${c.bar}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-extrabold truncate">{s.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{s.semester ?? "—"}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${s.name}`} onClick={() => setEditSubject(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${s.name}`} onClick={() => removeSubject(s)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {s.chapters.length} chapters</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {done}/{topics.length} topics</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-bold">{pct}% complete</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  {nextExam ? (
                    <Badge className={`${daysBetween(todayStr(), nextExam.date) <= 7 ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200" : "bg-mint-soft text-teal-800 dark:text-teal-100"} border-0 rounded-full`}>
                      Exam in {daysBetween(todayStr(), nextExam.date)} day{daysBetween(todayStr(), nextExam.date) === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs" onClick={() => setView("syllabus")}>
                      <Plus className="h-3 w-3 mr-1" /> Add chapters & topics
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editSubject !== null} onOpenChange={(open) => !open && setEditSubject(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>Edit subject</DialogTitle></DialogHeader>
          {editSubject ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5"><Label>Name</Label>
                <Input value={editSubject.name} onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Semester</Label>
                <Input value={editSubject.semester ?? ""} onChange={(e) => setEditSubject({ ...editSubject, semester: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Colour</Label>
                <div className="flex gap-2">
                  {COLOR_KEYS.map((c) => (
                    <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setEditSubject({ ...editSubject, color: c })}
                      className={`h-8 w-8 rounded-full ${subjectColor(c).dot} ${editSubject.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} />
                  ))}
                </div></div>
            </div>
          ) : null}
          <DialogFooter><Button className="rounded-full" onClick={saveEdit}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
