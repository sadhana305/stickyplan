"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, EmptyState, ErrorState, AIRunning, ProgressBar } from "@/components/app/shared";
import { QuizRunner, type RunnerQ } from "@/components/app/QuizRunner";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  FileQuestion, Search, Plus, Upload, Link2, Play, ListChecks, Bookmark, Trash2, Pencil,
  Sparkles, CalendarPlus, Repeat2, ChevronDown, ChevronUp, Eye, X, CheckCircle2, Loader2,
  FileText, Image as ImageIcon, StickyNote, CircleDashed, BookX,
} from "lucide-react";

type QbQuestion = {
  id: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  examName: string;
  marks: number;
  type: string;
  question: string;
  options: string | null;
  answer: string | null;
  answerSource: string;
  aiAnswer: string | null;
  docId: string | null;
  docTitle: string | null;
  bookmarked: boolean;
  status: string;
};

type DocMeta = { id: string; name: string; kind: string; category: string; textState: string };

type ExtractedQ = { key: string; question: string; type: string; marks: number; options?: string[]; answerInPaper: string | null; include: boolean };
type MatchRow = { id: string; question: string; marks: number; answer: string | null; confident: boolean; edited?: string };

const MARK_OPTIONS = [1, 2, 5, 10, 13, 16];
const TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice", TRUE_FALSE: "True/False", FILL_BLANK: "Fill in the blank", MATCH: "Match",
  VERY_SHORT: "Very short", SHORT: "Short answer", LONG: "Long answer", DESCRIPTIVE: "Essay",
  NUMERICAL: "Numerical", APPLICATION: "Application",
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: "Not started", cls: "bg-muted text-muted-foreground" },
  LEARNING: { label: "Learning", cls: "bg-lemon-soft text-yellow-900 dark:text-yellow-100" },
  COMPLETED: { label: "Completed", cls: "bg-mint text-white" },
  NEEDS_REVISION: { label: "Needs revision", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200" },
};

function parseOptions(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "null");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function QBankView() {
  const { toast } = useToast();
  const qbankDocFilter = useApp((s) => s.qbankDocFilter);
  const setQbankDocFilter = useApp((s) => s.setQbankDocFilter);

  const [questions, setQuestions] = useState<QbQuestion[] | null>(null);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [topic, setTopic] = useState("all");
  const [marks, setMarks] = useState("all");
  const [status, setStatus] = useState("all");
  const [bookmarked, setBookmarked] = useState(false);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // add question dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ question: "", answer: "", marks: "2", type: "SHORT", subjectName: "", chapterName: "", topicName: "", examName: "" });
  const [saving, setSaving] = useState(false);

  // extract flow
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractDocId, setExtractDocId] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedQ[] | null>(null);
  const [extractMeta, setExtractMeta] = useState<{ docId: string; docTitle: string } | null>(null);
  const [savingExtract, setSavingExtract] = useState(false);

  // match answers flow
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchDocId, setMatchDocId] = useState("");
  const [matching, setMatching] = useState(false);
  const [matchRows, setMatchRows] = useState<MatchRow[] | null>(null);
  const [applyingMatch, setApplyingMatch] = useState(false);

  // edit dialog
  const [editQ, setEditQ] = useState<QbQuestion | null>(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "", marks: "2", type: "SHORT", subjectName: "", chapterName: "", topicName: "", examName: "" });

  // practice mode
  const [practice, setPractice] = useState<QbQuestion[] | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [practiceDraft, setPracticeDraft] = useState("");
  const [quiz, setQuiz] = useState<{ quizId: string; questions: RunnerQ[] } | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (subject !== "all") params.set("subject", subject);
    if (chapter !== "all") params.set("chapter", chapter);
    if (topic !== "all") params.set("topic", topic);
    if (marks !== "all") params.set("marks", marks);
    if (status !== "all") params.set("status", status);
    if (bookmarked) params.set("bookmarked", "1");
    if (unansweredOnly) params.set("unanswered", "1");
    if (qbankDocFilter) params.set("docId", qbankDocFilter);
    Promise.all([
      api<{ questions: QbQuestion[] }>(`/api/qbank/questions?${params.toString()}`),
      api<{ docs: DocMeta[] }>("/api/library/docs"),
    ])
      .then(([qb, d]) => {
        setQuestions(qb.questions);
        setDocs(d.docs);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your question bank."));
  }, [q, subject, chapter, topic, marks, status, bookmarked, unansweredOnly, qbankDocFilter]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const subjects = useMemo(() => [...new Set((questions ?? []).map((x) => x.subjectName).filter(Boolean))].sort(), [questions]);
  const chapters = useMemo(() => [...new Set((questions ?? []).filter((x) => subject === "all" || x.subjectName === subject).map((x) => x.chapterName).filter(Boolean))].sort(), [questions, subject]);
  const topics = useMemo(() => [...new Set((questions ?? []).filter((x) => (subject === "all" || x.subjectName === subject) && (chapter === "all" || x.chapterName === chapter)).map((x) => x.topicName).filter(Boolean))].sort(), [questions, subject, chapter]);

  const stats = useMemo(() => {
    const all = questions ?? [];
    return {
      total: all.length,
      answered: all.filter((x) => x.answer).length,
      aiDrafts: all.filter((x) => !x.answer && x.aiAnswer).length,
      needsRevision: all.filter((x) => x.status === "NEEDS_REVISION").length,
      completed: all.filter((x) => x.status === "COMPLETED").length,
      pending: all.filter((x) => x.status === "NOT_STARTED").length,
    };
  }, [questions]);

  const selectedQuestions = useMemo(() => (questions ?? []).filter((x) => selected.has(x.id)), [questions, selected]);
  const filterDoc = docs.find((d) => d.id === qbankDocFilter);

  // ── actions ──────────────────────────────────────────────────────
  async function addQuestion() {
    setSaving(true);
    try {
      const r = await api<{ message: string }>("/api/qbank/questions", {
        method: "POST",
        body: {
          question: addForm.question,
          answer: addForm.answer || undefined,
          answerSource: "original",
          marks: Number(addForm.marks),
          type: addForm.type,
          subjectName: addForm.subjectName,
          chapterName: addForm.chapterName,
          topicName: addForm.topicName,
          examName: addForm.examName,
        },
      });
      toast({ title: r.message });
      setAddOpen(false);
      setAddForm({ question: "", answer: "", marks: "2", type: "SHORT", subjectName: "", chapterName: "", topicName: "", examName: "" });
      load();
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function runExtract() {
    if (!extractDocId) return;
    setExtracting(true);
    setExtracted(null);
    try {
      const r = await api<{ questions: Omit<ExtractedQ, "include">[]; docId: string; docTitle: string }>("/api/qbank/extract", {
        method: "POST",
        body: { docId: extractDocId },
      });
      setExtracted(r.questions.map((x) => ({ ...x, include: true })));
      setExtractMeta({ docId: r.docId, docTitle: r.docTitle });
      if (r.questions.length === 0) toast({ title: "No questions found in that document.", description: "If it's a scanned photo, make sure the text is readable." });
    } catch (e) {
      toast({ title: "Extraction failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  }

  async function saveExtracted() {
    if (!extracted || !extractMeta) return;
    const items = extracted
      .filter((x) => x.include && x.question.trim())
      .map((x) => ({
        question: x.question,
        type: x.type,
        marks: x.marks,
        options: x.options,
        answer: x.answerInPaper ?? undefined,
        answerSource: "original",
        subjectName: "",
        chapterName: "",
        topicName: "",
        docId: extractMeta.docId,
        docTitle: extractMeta.docTitle,
      }));
    if (items.length === 0) return;
    setSavingExtract(true);
    try {
      const r = await api<{ message: string }>("/api/qbank/questions", { method: "POST", body: { items } });
      toast({ title: r.message });
      setExtractOpen(false);
      setExtracted(null);
      setExtractDocId("");
      load();
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSavingExtract(false);
    }
  }

  async function runMatch() {
    if (!matchDocId) return;
    const ids = selectedQuestions.map((x) => x.id);
    if (ids.length === 0) {
      toast({ title: "Select some questions first (tick the boxes on the left)." });
      return;
    }
    setMatching(true);
    setMatchRows(null);
    try {
      const r = await api<{ matches: MatchRow[]; matchedCount: number }>("/api/qbank/match", {
        method: "POST",
        body: { answerDocId: matchDocId, questionIds: ids },
      });
      setMatchRows(r.matches);
      toast({ title: `${r.matchedCount} answer(s) matched — review below before saving.`, description: "You can correct any match before applying it." });
    } catch (e) {
      toast({ title: "Matching failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setMatching(false);
    }
  }

  async function applyMatches() {
    if (!matchRows) return;
    const toApply = matchRows.filter((m) => (m.edited ?? m.answer)?.trim());
    if (toApply.length === 0) return;
    setApplyingMatch(true);
    try {
      for (const m of toApply) {
        await api("/api/qbank/questions", { method: "PATCH", body: { id: m.id, answer: m.edited ?? m.answer, answerSource: "original" } });
      }
      toast({ title: `Applied ${toApply.length} answer(s) from your uploaded sheet.` });
      setMatchOpen(false);
      setMatchRows(null);
      setMatchDocId("");
      load();
    } catch (e) {
      toast({ title: "Could not apply", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setApplyingMatch(false);
    }
  }

  async function patchQuestion(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const r = await api<{ question: QbQuestion }>("/api/qbank/questions", { method: "PATCH", body: { id, ...body } });
      setQuestions((qs) => (qs ?? []).map((x) => (x.id === id ? { ...x, ...r.question } : x)));
      return r.question;
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function deleteQuestion(qq: QbQuestion) {
    if (!confirm(`Delete this question?\n\n"${qq.question.slice(0, 100)}"`)) return;
    try {
      await api(`/api/qbank/questions?id=${qq.id}`, { method: "DELETE" });
      setQuestions((qs) => (qs ?? []).filter((x) => x.id !== qq.id));
      setSelected((s) => { const n = new Set(s); n.delete(qq.id); return n; });
    } catch { /* ignore */ }
  }

  async function generateAiAnswer(qq: QbQuestion) {
    setBusyId(qq.id);
    try {
      const r = await api<{ aiAnswer: string; note: string }>("/api/qbank/ai-answer", { method: "POST", body: { id: qq.id } });
      setQuestions((qs) => (qs ?? []).map((x) => (x.id === qq.id ? { ...x, aiAnswer: r.aiAnswer } : x)));
      toast({ title: "AI draft ready 🤖", description: r.note });
    } catch (e) {
      toast({ title: "Could not generate", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(qq: QbQuestion) {
    setEditQ(qq);
    setEditForm({
      question: qq.question,
      answer: qq.answer ?? "",
      marks: String(qq.marks),
      type: qq.type,
      subjectName: qq.subjectName,
      chapterName: qq.chapterName,
      topicName: qq.topicName,
      examName: qq.examName,
    });
  }

  async function saveEdit() {
    if (!editQ) return;
    await patchQuestion(editQ.id, {
      question: editForm.question,
      marks: Number(editForm.marks),
      type: editForm.type,
      subjectName: editForm.subjectName,
      chapterName: editForm.chapterName,
      topicName: editForm.topicName,
      examName: editForm.examName,
      answer: editForm.answer,
      answerSource: "original",
    });
    toast({ title: "Question updated ✏️" });
    setEditQ(null);
  }

  // ── practice ─────────────────────────────────────────────────────
  function startPractice(list?: QbQuestion[]) {
    const pool = list && list.length > 0 ? list : selectedQuestions.length > 0 ? selectedQuestions : questions ?? [];
    if (pool.length === 0) {
      toast({ title: "No questions to practise." });
      return;
    }
    setPractice(pool);
    setPracticeIndex(0);
    setRevealed(false);
    setPracticeDraft("");
  }

  async function markAndNext(status: string) {
    if (!practice) return;
    const current = practice[practiceIndex];
    if (current) {
      const body: Record<string, unknown> = { id: current.id, status };
      if (practiceDraft.trim() && !current.answer) {
        body.answer = practiceDraft;
        body.answerSource = "original";
      }
      await patchQuestion(current.id, body);
    }
    if (practiceIndex + 1 >= practice.length) {
      toast({ title: "Practice complete 💪", description: "Your answers and statuses are saved." });
      setPractice(null);
      return;
    }
    setPracticeIndex((i) => i + 1);
    setRevealed(false);
    setPracticeDraft("");
  }

  async function makeQuizFromSelected() {
    const ids = (selectedQuestions.length > 0 ? selectedQuestions : (questions ?? []).filter((x) => x.answer || x.aiAnswer)).map((x) => x.id);
    if (ids.length === 0) return;
    try {
      const r = await api<{ quizId: string; questions: RunnerQ[]; skippedCount: number }>("/api/qbank/quiz", { method: "POST", body: { ids } });
      setQuiz({ quizId: r.quizId, questions: r.questions });
      if (r.skippedCount > 0) toast({ title: `${r.skippedCount} question(s) skipped — no answer available to grade against yet.` });
    } catch (e) {
      toast({ title: "Could not create the quiz", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addSelectedToPlanner() {
    if (selectedQuestions.length === 0) return;
    try {
      const r = await api<{ message: string }>("/api/library/plan", { method: "POST", body: { questionIds: selectedQuestions.map((x) => x.id) } });
      toast({ title: r.message, description: "Added alongside your plan — nothing was rescheduled." });
      setSelected(new Set());
    } catch (e) {
      toast({ title: "Could not add", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addSelectedToRevision() {
    if (selectedQuestions.length === 0) return;
    try {
      let added = 0;
      for (const q of selectedQuestions.slice(0, 10)) {
        const r = await api<{ duplicate?: boolean }>("/api/library/revision", {
          method: "POST",
          body: { action: "create", title: q.question.slice(0, 160), subtitle: q.subjectName || "My Q&A Bank", questionId: q.id },
        });
        if (!r.duplicate) added++;
      }
      toast({ title: `${added} question(s) added to your revision schedule 🔁`, description: "1 · 3 · 7 · 14 · 30 day ladder." });
      setSelected(new Set());
    } catch (e) {
      toast({ title: "Could not schedule", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const docIcon = (kind: string) => (kind === "PDF" ? <FileText className="h-3.5 w-3.5" /> : kind === "IMAGE" ? <ImageIcon className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Q&A Bank"
        subtitle="Your own questions from papers and notes — with answers you trust, organised by marks."
        icon={<FileQuestion className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setExtractOpen(true); setExtracted(null); setExtractDocId(""); }}>
              <Upload className="h-4 w-4 mr-1.5" /> From question paper
            </Button>
            <Button className="rounded-full" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add question
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Questions", value: stats.total, cls: "" },
          { label: "With answers", value: stats.answered, cls: "text-mint" },
          { label: "AI drafts only", value: stats.aiDrafts, cls: "text-lavender" },
          { label: "Completed", value: stats.completed, cls: "text-sky" },
          { label: "Needs revision", value: stats.needsRevision, cls: "text-rose-500" },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn("text-xl font-extrabold", s.cls)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search questions and answers…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search questions" />
          </div>
          <Select value={marks} onValueChange={setMarks}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All marks</SelectItem>
              {MARK_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} marks</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={bookmarked ? "default" : "outline"} size="sm" className="rounded-full h-10" onClick={() => setBookmarked((v) => !v)} aria-pressed={bookmarked}>
            <Bookmark className={cn("h-4 w-4 mr-1", bookmarked && "fill-current")} /> Saved
          </Button>
          <Button variant={unansweredOnly ? "default" : "outline"} size="sm" className="rounded-full h-10" onClick={() => setUnansweredOnly((v) => !v)} aria-pressed={unansweredOnly}>
            <BookX className="h-4 w-4 mr-1" /> Unanswered
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subject} onValueChange={(v) => { setSubject(v); setChapter("all"); setTopic("all"); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={chapter} onValueChange={(v) => { setChapter(v); setTopic("all"); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {chapters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="rounded-full h-9" onClick={() => setMatchOpen(true)} disabled={selectedQuestions.length === 0}>
            <Link2 className="h-3.5 w-3.5 mr-1" /> Match answers ({selectedQuestions.length})
          </Button>
        </div>
        {filterDoc ? (
          <div className="flex items-center gap-2 text-xs rounded-lg border border-sky/40 bg-sky-soft/40 dark:bg-sky-soft/10 px-3 py-2">
            {docIcon(filterDoc.kind)}
            <span className="font-semibold">Showing questions from “{filterDoc.name}”</span>
            <button type="button" className="ml-auto underline hover:text-rose-500" onClick={() => setQbankDocFilter(null)}>show all</button>
          </div>
        ) : null}
      </div>

      {/* Bulk bar */}
      {selectedQuestions.length > 0 ? (
        <Card className="rounded-xl sticky top-16 z-30 bg-card/95 backdrop-blur">
          <CardContent className="py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{selectedQuestions.length} selected</span>
            <Button size="sm" className="rounded-full h-8" onClick={() => startPractice()}><Play className="h-3.5 w-3.5 mr-1" /> Practise</Button>
            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={makeQuizFromSelected}><ListChecks className="h-3.5 w-3.5 mr-1" /> Quiz from these</Button>
            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={addSelectedToPlanner}><CalendarPlus className="h-3.5 w-3.5 mr-1" /> To planner</Button>
            <Button size="sm" variant="outline" className="rounded-full h-8" onClick={addSelectedToRevision}><Repeat2 className="h-3.5 w-3.5 mr-1" /> To revision</Button>
            <Button size="sm" variant="ghost" className="rounded-full h-8 ml-auto" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5 mr-1" /> Clear</Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {/* List */}
      {!questions ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="h-6 w-6" />}
          title="No questions here yet"
          description="Upload a question paper to extract its questions automatically, add them from your library notes, or type your own."
          action={
            <div className="flex gap-2">
              <Button className="rounded-full" onClick={() => { setExtractOpen(true); setExtracted(null); setExtractDocId(""); }}><Upload className="h-4 w-4 mr-1.5" /> From question paper</Button>
              <Button variant="outline" className="rounded-full" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add manually</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {questions.map((qq, i) => {
            const open = expanded === qq.id;
            const st = STATUS_META[qq.status] ?? STATUS_META.NOT_STARTED;
            return (
              <Card key={qq.id} className={cn("rounded-xl", qq.status === "COMPLETED" && "border-mint/40")}>
                <CardContent className="pt-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Checkbox checked={selected.has(qq.id)} onCheckedChange={() => toggleSelect(qq.id)} className="mt-1" aria-label="Select question" />
                    <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setExpanded(open ? null : qq.id)} aria-expanded={open}>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full text-[10px]">{qq.marks} mark{qq.marks > 1 ? "s" : ""}</Badge>
                        <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABELS[qq.type] ?? qq.type}</Badge>
                        <Badge className={cn("border-0 rounded-full text-[10px]", st.cls)}>{st.label}</Badge>
                        {qq.answer ? (
                          <Badge className="bg-mint-soft text-teal-800 dark:text-teal-100 border-0 rounded-full text-[10px]">
                            {qq.answerSource === "original" ? "your answer" : qq.answerSource === "ai" ? "AI answer (accepted)" : "answered"}
                          </Badge>
                        ) : qq.aiAnswer ? (
                          <Badge className="bg-lavender-soft text-violet-900 dark:text-violet-100 border-0 rounded-full text-[10px]">AI draft available</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full text-[10px]">no answer yet</Badge>
                        )}
                        {qq.docTitle ? <Badge variant="outline" className="rounded-full text-[10px]">📄 {qq.docTitle}</Badge> : <Badge variant="outline" className="rounded-full text-[10px]">✍️ typed</Badge>}
                        {qq.subjectName ? <span className="text-[10px] text-muted-foreground">{[qq.subjectName, qq.chapterName, qq.topicName].filter(Boolean).join(" › ")}</span> : null}
                      </div>
                      <p className={cn("text-sm font-semibold leading-relaxed", !open && "line-clamp-2")}>
                        <span className="text-muted-foreground mr-1">Q{i + 1}.</span>
                        {qq.question}
                      </p>
                    </button>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={qq.bookmarked ? "Remove bookmark" : "Bookmark"} onClick={() => patchQuestion(qq.id, { bookmarked: !qq.bookmarked })}>
                        <Bookmark className={cn("h-3.5 w-3.5", qq.bookmarked && "fill-peach text-peach")} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={open ? "Collapse" : "Expand"} onClick={() => setExpanded(open ? null : qq.id)}>
                        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {open ? (
                    <div className="space-y-3 pl-7 animate-fade-up">
                      {/* Answers */}
                      {qq.answer ? (
                        <div className="rounded-xl border border-mint/40 bg-mint-soft/30 dark:bg-mint-soft/10 p-3">
                          <p className="text-[11px] font-extrabold uppercase tracking-wide text-teal-800 dark:text-teal-200 mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {qq.answerSource === "original" ? "Answer from your material" : qq.answerSource === "ai" ? "AI answer — accepted by you" : "Answer"}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{qq.answer}</p>
                        </div>
                      ) : null}
                      {qq.aiAnswer ? (
                        <div className="rounded-xl border border-lavender/40 bg-lavender-soft/30 dark:bg-lavender-soft/10 p-3">
                          <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-1 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> AI-generated draft {qq.answer ? "(reference)" : ""}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{qq.aiAnswer}</p>
                          {!qq.answer ? (
                            <Button size="sm" variant="outline" className="rounded-full mt-2 h-7 text-xs" onClick={() => patchQuestion(qq.id, { answer: qq.aiAnswer, answerSource: "ai" })} disabled={busyId === qq.id}>
                              Accept as my answer (labelled AI)
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {!qq.answer && !qq.aiAnswer ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => generateAiAnswer(qq)} disabled={busyId === qq.id}>
                          {busyId === qq.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />} Generate AI answer
                        </Button>
                      ) : null}

                      {/* Status */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-muted-foreground mr-1">Status:</span>
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <button key={k} type="button" onClick={() => patchQuestion(qq.id, { status: k })} className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all", qq.status === k ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:border-mint/60")} aria-pressed={qq.status === k}>
                            {v.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => startPractice([qq])}><Play className="h-3.5 w-3.5 mr-1" /> Practise this</Button>
                        <Button size="sm" variant="outline" className="rounded-full h-8" onClick={async () => { const r = await api<{ message: string }>("/api/library/plan", { method: "POST", body: { questionIds: [qq.id] } }); toast({ title: r.message }); }}><CalendarPlus className="h-3.5 w-3.5 mr-1" /> To planner</Button>
                        <Button size="sm" variant="outline" className="rounded-full h-8" onClick={async () => { await api("/api/library/revision", { method: "POST", body: { action: "create", title: qq.question.slice(0, 160), subtitle: qq.subjectName || "My Q&A Bank", questionId: qq.id } }); toast({ title: "Added to revision schedule 🔁" }); }}><Repeat2 className="h-3.5 w-3.5 mr-1" /> To revision</Button>
                        <Button size="sm" variant="ghost" className="rounded-full h-8" onClick={() => openEdit(qq)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                        <Button size="sm" variant="ghost" className="rounded-full h-8 text-rose-500" onClick={() => deleteQuestion(qq)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add question dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Add a question</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label className="text-xs">Question *</Label><Textarea rows={3} value={addForm.question} onChange={(e) => setAddForm({ ...addForm, question: e.target.value })} placeholder="Type the question exactly as it should appear" /></div>
            <div className="space-y-1"><Label className="text-xs">Answer (optional — add later if you like)</Label><Textarea rows={3} value={addForm.answer} onChange={(e) => setAddForm({ ...addForm, answer: e.target.value })} placeholder="Your answer or the answer from your material" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Marks</Label>
                <Select value={addForm.marks} onValueChange={(v) => setAddForm({ ...addForm, marks: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MARK_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} marks</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={addForm.subjectName} onChange={(e) => setAddForm({ ...addForm, subjectName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Chapter</Label><Input value={addForm.chapterName} onChange={(e) => setAddForm({ ...addForm, chapterName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Topic</Label><Input value={addForm.topicName} onChange={(e) => setAddForm({ ...addForm, topicName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Exam</Label><Input value={addForm.examName} onChange={(e) => setAddForm({ ...addForm, examName: e.target.value })} placeholder="optional" /></div>
            </div>
          </div>
          <DialogFooter><Button className="rounded-full" onClick={addQuestion} disabled={saving || !addForm.question.trim()}>{saving ? "Saving…" : "Save question"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract dialog */}
      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Extract questions from a paper</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Question paper (from My Study Library)</Label>
              <div className="flex gap-2">
                <Select value={extractDocId} onValueChange={setExtractDocId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose an uploaded PDF / photo" /></SelectTrigger>
                  <SelectContent>
                    {docs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="inline-flex items-center gap-1.5">{docIcon(d.kind)}{d.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="rounded-full shrink-0" onClick={runExtract} disabled={!extractDocId || extracting}>
                  {extracting ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Reading…</>) : "Extract"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">The AI reads the paper (including photos with OCR) and lists its questions. Nothing is saved until you review below.</p>
            </div>

            {extracting ? <AIRunning label="Reading the paper and pulling out questions…" /> : null}

            {extracted ? (
              extracted.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">No questions were found in this document. If it&apos;s a photo, try a sharper one.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold">Review {extracted.length} extracted questions</p>
                    <Button size="sm" className="rounded-full" onClick={saveExtracted} disabled={savingExtract || extracted.every((x) => !x.include)}>
                      {savingExtract ? "Saving…" : `Save ${extracted.filter((x) => x.include).length} to bank`}
                    </Button>
                  </div>
                  {extracted.map((x, i) => (
                    <div key={x.key} className={cn("rounded-xl border p-3 space-y-2", !x.include && "opacity-50")}>
                      <div className="flex items-start gap-2">
                        <Checkbox checked={x.include} onCheckedChange={(c) => setExtracted((arr) => (arr ?? []).map((y, j) => (j === i ? { ...y, include: c === true } : y)))} className="mt-0.5" aria-label="Include question" />
                        <Textarea rows={2} className="flex-1 text-xs" value={x.question} onChange={(e) => setExtracted((arr) => (arr ?? []).map((y, j) => (j === i ? { ...y, question: e.target.value } : y)))} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <span className="text-[11px] font-bold text-muted-foreground">Marks:</span>
                        {[1, 2, 5, 10, 13, 16].map((m) => (
                          <button key={m} type="button" onClick={() => setExtracted((arr) => (arr ?? []).map((y, j) => (j === i ? { ...y, marks: m } : y)))} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", x.marks === m ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:border-mint/60")} aria-pressed={x.marks === m}>
                            {m}
                          </button>
                        ))}
                        <Select value={x.type} onValueChange={(v) => setExtracted((arr) => (arr ?? []).map((y, j) => (j === i ? { ...y, type: v } : y)))}>
                          <SelectTrigger className="w-36 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                        </Select>
                        {x.answerInPaper ? <Badge className="bg-mint-soft text-teal-800 dark:text-teal-100 border-0 rounded-full text-[10px]">answer found in paper ✓</Badge> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Match answers dialog */}
      <Dialog open={matchOpen} onOpenChange={(o) => { setMatchOpen(o); if (!o) setMatchRows(null); }}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Match answers from an answer sheet</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Answer PDF / photo (from My Study Library)</Label>
              <div className="flex gap-2">
                <Select value={matchDocId} onValueChange={setMatchDocId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose the answer document" /></SelectTrigger>
                  <SelectContent>
                    {docs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="inline-flex items-center gap-1.5">{docIcon(d.kind)}{d.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="rounded-full shrink-0" onClick={runMatch} disabled={!matchDocId || matching}>
                  {matching ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Matching…</>) : "Match"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Matches the {selectedQuestions.length} selected question(s) with answers in that document. Every match is shown for your review — nothing saves automatically.</p>
            </div>

            {matching ? <AIRunning label="Reading the answer sheet and pairing answers…" /> : null}

            {matchRows ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold">Review matches</p>
                  <Button size="sm" className="rounded-full" onClick={applyMatches} disabled={applyingMatch || matchRows.every((m) => !(m.edited ?? m.answer)?.trim())}>
                    {applyingMatch ? "Applying…" : "Apply checked answers"}
                  </Button>
                </div>
                {matchRows.map((m) => (
                  <div key={m.id} className="rounded-xl border p-3 space-y-1.5">
                    <p className="text-sm font-semibold">{m.question.slice(0, 160)}{m.question.length > 160 ? "…" : ""}</p>
                    {m.answer ? (
                      <>
                        <Textarea rows={2} className="text-xs" value={m.edited ?? m.answer} onChange={(e) => setMatchRows((rows) => (rows ?? []).map((x) => (x.id === m.id ? { ...x, edited: e.target.value } : x)))} />
                        {m.confident ? <Badge className="bg-mint-soft text-teal-800 dark:text-teal-100 border-0 rounded-full text-[10px]">confident match</Badge> : <Badge className="bg-peach-soft text-orange-900 dark:text-orange-100 border-0 rounded-full text-[10px]">check this one</Badge>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CircleDashed className="h-3.5 w-3.5" /> No matching answer found in that sheet — leave empty to skip, or add one below in the question.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit question dialog */}
      <Dialog open={!!editQ} onOpenChange={(o) => !o && setEditQ(null)}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Edit question</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label className="text-xs">Question</Label><Textarea rows={3} value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Your answer</Label><Textarea rows={3} value={editForm.answer} onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Marks</Label>
                <Select value={editForm.marks} onValueChange={(v) => setEditForm({ ...editForm, marks: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MARK_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} marks</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={editForm.subjectName} onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Chapter</Label><Input value={editForm.chapterName} onChange={(e) => setEditForm({ ...editForm, chapterName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Topic</Label><Input value={editForm.topicName} onChange={(e) => setEditForm({ ...editForm, topicName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Exam</Label><Input value={editForm.examName} onChange={(e) => setEditForm({ ...editForm, examName: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button className="rounded-full" onClick={saveEdit} disabled={!editForm.question.trim()}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Practice dialog */}
      <Dialog open={!!practice} onOpenChange={(o) => !o && setPractice(null)}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
          <DialogHeader>
            <DialogTitle>Practice — question {practice ? practiceIndex + 1 : 0} of {practice?.length ?? 0}</DialogTitle>
          </DialogHeader>
          {practice ? (
            <div className="space-y-3 py-1">
              <ProgressBar value={((practiceIndex + (revealed ? 1 : 0)) / practice.length) * 100} />
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full text-[10px]">{practice[practiceIndex].marks} marks</Badge>
                <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABELS[practice[practiceIndex].type] ?? practice[practiceIndex].type}</Badge>
                {practice[practiceIndex].subjectName ? <span className="text-xs text-muted-foreground">{practice[practiceIndex].subjectName}</span> : null}
              </div>
              <p className="text-sm font-bold leading-relaxed">{practice[practiceIndex].question}</p>
              <Textarea rows={4} placeholder="Write your answer as if in the exam… (saved with the question if it doesn't have one yet)" value={practiceDraft} onChange={(e) => setPracticeDraft(e.target.value)} />
              {revealed ? (
                <div className="space-y-2 animate-fade-up">
                  {practice[practiceIndex].answer ? (
                    <div className="rounded-xl border border-mint/40 bg-mint-soft/30 dark:bg-mint-soft/10 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-teal-800 dark:text-teal-200 mb-1">{practice[practiceIndex].answerSource === "original" ? "Answer from your material" : "Accepted answer"}</p>
                      <p className="text-sm whitespace-pre-wrap">{practice[practiceIndex].answer}</p>
                    </div>
                  ) : null}
                  {practice[practiceIndex].aiAnswer ? (
                    <div className="rounded-xl border border-lavender/40 bg-lavender-soft/30 dark:bg-lavender-soft/10 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-800 dark:text-violet-200 mb-1"><Sparkles className="h-3 w-3 inline mr-1" />AI-generated draft</p>
                      <p className="text-sm whitespace-pre-wrap">{practice[practiceIndex].aiAnswer}</p>
                    </div>
                  ) : null}
                  {!practice[practiceIndex].answer && !practice[practiceIndex].aiAnswer ? (
                    <p className="text-sm text-muted-foreground">No answer saved for this question yet — generate one after practice from its expanded card.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {!revealed ? (
                  <Button className="rounded-full" onClick={() => setRevealed(true)}><Eye className="h-4 w-4 mr-1.5" /> Reveal answer</Button>
                ) : (
                  <>
                    <Button size="sm" className="rounded-full h-9" onClick={() => markAndNext("COMPLETED")}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> I got it — completed</Button>
                    <Button size="sm" variant="outline" className="rounded-full h-9" onClick={() => markAndNext("LEARNING")}>Still learning</Button>
                    <Button size="sm" variant="outline" className="rounded-full h-9 border-rose-300 text-rose-600 dark:text-rose-400" onClick={() => markAndNext("NEEDS_REVISION")}>Needs revision</Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="rounded-full h-9 ml-auto" onClick={() => setPractice(null)}>Exit practice</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={!!quiz} onOpenChange={(o) => !o && setQuiz(null)}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Quiz from your selected questions</DialogTitle></DialogHeader>
          {quiz ? <QuizRunner quizId={quiz.quizId} questions={quiz.questions} title="Graded like the Daily Quiz — it counts toward your streak." /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
