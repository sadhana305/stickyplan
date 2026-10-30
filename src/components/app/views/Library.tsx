"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, downloadTextFile } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { QuizRunner, type RunnerQ } from "@/components/app/QuizRunner";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  LibraryBig, Upload, FolderPlus, Search, Bookmark, Download, Trash2, Pencil, FolderInput,
  FileText, Image as ImageIcon, StickyNote, Sparkles, FileQuestion, CalendarPlus, Repeat2,
  BookOpen, MessageSquarePlus, Highlighter, X, MoreHorizontal, Star, Layers, ListChecks, Loader2,
} from "lucide-react";

type DocMeta = {
  id: string;
  folderId: string | null;
  name: string;
  kind: "PDF" | "IMAGE" | "TEXT";
  category: string;
  description: string;
  tags: string;
  bookmarked: boolean;
  size: number;
  mime: string;
  ext: string;
  textState: string;
  textNote: string;
  subjectName: string;
  chapterName: string;
  topicName: string;
  examName: string;
  createdAt: string;
  _count: { comments: number };
};

type Folder = { id: string; name: string; parentId: string | null; _count: { docs: number; children: number } };

type Comment = { id: string; page: number | null; quote: string; note: string; color: string; createdAt: string };

type Keypoints = { keyPoints: string[]; definitions: { term: string; meaning: string }[]; formulas: { name: string; expression: string }[] };
type GenQuestions = { question: string; type: string; marks: number; answerHint?: string }[];
type Flashcards = { front: string; back: string }[];

const CATEGORIES = [
  { id: "notes", label: "Notes" },
  { id: "question_paper", label: "Question paper" },
  { id: "answer_sheet", label: "Answer sheet" },
  { id: "textbook", label: "Textbook photo" },
  { id: "typed", label: "Typed note" },
  { id: "other", label: "Other" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const HIGHLIGHT_COLORS: Record<string, string> = {
  mint: "bg-mint/25",
  lemon: "bg-lemon/35",
  peach: "bg-peach/25",
  sky: "bg-sky/25",
  lavender: "bg-lavender/25",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_code]:bg-muted [&_code]:rounded [&_code]:px-1">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

export function LibraryView() {
  const { toast } = useToast();
  const setQbankDocFilter = useApp((s) => s.setQbankDocFilter);
  const setView = useApp((s) => s.setView);

  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [folderId, setFolderId] = useState<"all" | "root" | string>("all");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [tag, setTag] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [upCategory, setUpCategory] = useState("notes");
  const [upFolder, setUpFolder] = useState("root");
  const [upDesc, setUpDesc] = useState("");
  const [upTags, setUpTags] = useState("");
  const [upSubject, setUpSubject] = useState("");
  const [upChapter, setUpChapter] = useState("");
  const [upTopic, setUpTopic] = useState("");
  const [upExam, setUpExam] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderParent, setFolderParent] = useState("root");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  const [editDoc, setEditDoc] = useState<DocMeta | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", tags: "", subjectName: "", chapterName: "", topicName: "", examName: "", category: "notes", folderId: "root" });

  const [openDoc, setOpenDoc] = useState<DocMeta | null>(null);
  const [detail, setDetail] = useState<{ results: Record<string, unknown>; text: string; textState: string; textNote: string } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [askInput, setAskInput] = useState("");
  const [askThread, setAskThread] = useState<{ q: string; a: string }[]>([]);
  const [selection, setSelection] = useState("");
  const [commentNote, setCommentNote] = useState("");
  const [commentPage, setCommentPage] = useState("");
  const [commentColor, setCommentColor] = useState("mint");
  const [readMode, setReadMode] = useState<"file" | "text">("file");
  const [quiz, setQuiz] = useState<{ quizId: string; questions: RunnerQ[] } | null>(null);
  const [planDate, setPlanDate] = useState("");
  const [planMinutes, setPlanMinutes] = useState("30");
  const [planType, setPlanType] = useState("LEARN");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (docs ?? []).forEach((d) => {
      try {
        (JSON.parse(d.tags) as string[]).forEach((t) => set.add(t));
      } catch { /* ignore */ }
    });
    return [...set].sort().slice(0, 18);
  }, [docs]);

  const rootFolders = useMemo(() => folders.filter((f) => !f.parentId), [folders]);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    params.set("folderId", folderId);
    if (category !== "all") params.set("category", category);
    if (kind !== "all") params.set("kind", kind);
    if (onlyBookmarked) params.set("bookmarked", "1");
    if (tag) params.set("tag", tag);
    Promise.all([
      api<{ docs: DocMeta[] }>(`/api/library/docs?${params.toString()}`),
      api<{ folders: Folder[] }>("/api/library/folders"),
    ])
      .then(([d, f]) => {
        setDocs(d.docs);
        setFolders(f.folders);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your library."));
  }, [q, folderId, category, kind, onlyBookmarked, tag]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // ── upload ───────────────────────────────────────────────────────
  async function upload() {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("category", upCategory);
      form.append("folderId", upFolder === "root" ? "" : upFolder);
      form.append("description", upDesc);
      form.append("tags", JSON.stringify(upTags.split(",").map((t) => t.trim()).filter(Boolean)));
      form.append("subjectName", upSubject);
      form.append("chapterName", upChapter);
      form.append("topicName", upTopic);
      form.append("examName", upExam);
      const res = await fetch("/api/library/docs", { method: "POST", body: form });
      const data = (await res.json()) as { message?: string; skipped?: string[]; error?: string; created?: { name: string }[] };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      toast({ title: data.message ?? "Upload complete ✅", description: data.skipped?.length ? `Skipped: ${data.skipped.join("; ")}` : undefined });
      setUploadOpen(false);
      resetUploadForm();
      load();
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function resetUploadForm() {
    setFiles([]);
    setUpDesc("");
    setUpTags("");
    setUpSubject("");
    setUpChapter("");
    setUpTopic("");
    setUpExam("");
    setUpCategory("notes");
  }

  // ── folders ──────────────────────────────────────────────────────
  async function saveFolder() {
    try {
      if (editingFolder) {
        await api("/api/library/folders", { method: "PATCH", body: { id: editingFolder.id, name: folderName } });
        toast({ title: "Folder renamed 📁" });
      } else {
        await api("/api/library/folders", { method: "POST", body: { name: folderName, parentId: folderParent === "root" ? null : folderParent } });
        toast({ title: "Folder created 📁" });
      }
      setFolderOpen(false);
      setEditingFolder(null);
      setFolderName("");
      load();
    } catch (e) {
      toast({ title: "Could not save folder", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function deleteFolder(f: Folder) {
    const childCount = f._count.children;
    if (!confirm(`Delete folder "${f.name}"?${childCount ? ` Its ${childCount} sub-folder(s) will also be deleted.` : ""} Files inside are kept and move to Unfiled.`)) return;
    try {
      await api(`/api/library/folders?id=${f.id}`, { method: "DELETE" });
      if (folderId === f.id) setFolderId("all");
      load();
    } catch (e) {
      toast({ title: "Could not delete folder", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  // ── doc actions ──────────────────────────────────────────────────
  async function toggleBookmark(doc: DocMeta) {
    try {
      await api("/api/library/docs", { method: "PATCH", body: { id: doc.id, bookmarked: !doc.bookmarked } });
      if (openDoc?.id === doc.id) setOpenDoc({ ...openDoc, bookmarked: !doc.bookmarked });
      load();
    } catch { /* ignore */ }
  }

  async function deleteDoc(doc: DocMeta) {
    if (!confirm(`Delete "${doc.name}"? Its highlights, comments and AI results are removed too. This cannot be undone.`)) return;
    try {
      await api(`/api/library/docs?id=${doc.id}`, { method: "DELETE" });
      toast({ title: "Deleted." });
      if (openDoc?.id === doc.id) setOpenDoc(null);
      load();
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function openEdit(doc: DocMeta) {
    setEditDoc(doc);
    setEditForm({
      name: doc.name,
      description: doc.description,
      tags: (() => { try { return (JSON.parse(doc.tags) as string[]).join(", "); } catch { return ""; } })(),
      subjectName: doc.subjectName,
      chapterName: doc.chapterName,
      topicName: doc.topicName,
      examName: doc.examName,
      category: doc.category,
      folderId: doc.folderId ?? "root",
    });
  }

  async function saveEdit() {
    if (!editDoc) return;
    try {
      await api("/api/library/docs", {
        method: "PATCH",
        body: {
          id: editDoc.id,
          name: editForm.name,
          description: editForm.description,
          tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
          subjectName: editForm.subjectName,
          chapterName: editForm.chapterName,
          topicName: editForm.topicName,
          examName: editForm.examName,
          category: editForm.category,
          folderId: editForm.folderId === "root" ? null : editForm.folderId,
        },
      });
      toast({ title: "Details updated ✏️" });
      setEditDoc(null);
      if (openDoc?.id === editDoc.id) setOpenDoc({ ...openDoc, ...editForm, tags: JSON.stringify(editForm.tags.split(",").map((t) => t.trim()).filter(Boolean)), folderId: editForm.folderId === "root" ? null : editForm.folderId });
      load();
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  // ── detail + AI ──────────────────────────────────────────────────
  function openDetail(doc: DocMeta) {
    setOpenDoc(doc);
    setDetail(null);
    setComments([]);
    setAskThread([]);
    setAskInput("");
    setSelection("");
    setReadMode(doc.kind === "TEXT" ? "text" : "file");
    setPlanDate("");
    api<{ results: Record<string, unknown>; text: string; textState: string; textNote: string }>(`/api/library/ai?docId=${doc.id}`)
      .then((r) => setDetail(r))
      .catch(() => setDetail({ results: {}, text: "", textState: doc.textState, textNote: doc.textNote }));
    api<{ comments: Comment[] }>(`/api/library/comments?docId=${doc.id}`)
      .then((r) => setComments(r.comments))
      .catch(() => undefined);
  }

  async function runAi(action: string) {
    if (!openDoc) return;
    setBusyAction(action);
    try {
      const r = await api<Record<string, unknown>>("/api/library/ai", { method: "POST", body: { docId: openDoc.id, action } });
      const resultKeys = ["summarize", "explain", "keypoints", "questions", "flashcards"];
      if (resultKeys.includes(action)) {
        setDetail((d) => (d ? { ...d, results: { ...d.results, [action]: r[action] }, textState: "READY" } : d));
        if (action === "summarize") toast({ title: "Notes ready 📖" });
        if (action === "questions") toast({ title: "Questions created — review & save them below." });
      }
      if (action === "quiz") {
        setQuiz({ quizId: String(r.quizId), questions: r.questions as RunnerQ[] });
      }
    } catch (e) {
      toast({ title: "AI step failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  }

  async function ask() {
    if (!openDoc || !askInput.trim()) return;
    const question = askInput.trim();
    setAskInput("");
    setBusyAction("ask");
    try {
      const r = await api<{ answer: string }>("/api/library/ai", { method: "POST", body: { docId: openDoc.id, action: "ask", question } });
      setAskThread((t) => [...t, { q: question, a: r.answer }]);
    } catch (e) {
      toast({ title: "Could not answer", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  }

  async function generateAnswersForExtracted() {
    if (!openDoc || !detail) return;
    const qs = (detail.results.questions as GenQuestions | undefined) ?? [];
    if (qs.length === 0) return;
    setBusyAction("answers");
    try {
      const r = await api<{ answers: { question: string; answer: string }[] }>("/api/library/ai", {
        method: "POST",
        body: { docId: openDoc.id, action: "answers", questions: qs.map((x) => x.question) },
      });
      setDetail((d) => (d ? { ...d, results: { ...d.results, answers: r.answers } } : d));
    } catch (e) {
      toast({ title: "Could not generate answers", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveQuestionsToBank(withAnswers: boolean) {
    if (!openDoc || !detail) return;
    const qs = (detail.results.questions as GenQuestions | undefined) ?? [];
    if (qs.length === 0) return;
    const answers = withAnswers ? ((detail.results.answers as { question: string; answer: string }[] | undefined) ?? []) : [];
    const items = qs.map((x) => ({
      question: x.question,
      type: x.type,
      marks: x.marks,
      subjectName: openDoc.subjectName,
      chapterName: openDoc.chapterName,
      topicName: openDoc.topicName || openDoc.name,
      examName: openDoc.examName,
      docId: openDoc.id,
      docTitle: openDoc.name,
      answer: undefined as string | undefined,
    }));
    if (withAnswers) {
      for (const it of items) {
        const m = answers.find((a) => a.question === it.question);
        if (m?.answer) {
          it.answer = m.answer;
          (it as { answerSource?: string }).answerSource = "ai";
        }
      }
    }
    try {
      const r = await api<{ message: string }>("/api/qbank/questions", { method: "POST", body: { items } });
      toast({ title: r.message, description: withAnswers ? "AI answers are saved as clearly-labelled drafts — review them in My Q&A Bank." : "Find them in My Q&A Bank." });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  // ── comments / highlights ────────────────────────────────────────
  function captureSelection() {
    const sel = window.getSelection()?.toString() ?? "";
    if (sel.trim()) setSelection(sel.trim().slice(0, 1000));
  }

  async function addComment() {
    if (!openDoc) return;
    if (!commentNote.trim() && !selection.trim()) {
      toast({ title: "Write a note or select text in the document first." });
      return;
    }
    try {
      const r = await api<{ comment: Comment }>("/api/library/comments", {
        method: "POST",
        body: { docId: openDoc.id, quote: selection, note: commentNote, color: commentColor, page: commentPage ? Number(commentPage) : undefined },
      });
      setComments((c) => [...c, r.comment]);
      setCommentNote("");
      setCommentPage("");
      setSelection("");
      toast({ title: "Saved to this document 📌" });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function deleteComment(id: string) {
    try {
      await api(`/api/library/comments?id=${id}`, { method: "DELETE" });
      setComments((c) => c.filter((x) => x.id !== id));
    } catch { /* ignore */ }
  }

  // ── planner / revision ───────────────────────────────────────────
  async function addToPlanner() {
    if (!openDoc) return;
    try {
      const r = await api<{ message: string }>("/api/library/plan", {
        method: "POST",
        body: { docId: openDoc.id, items: [{ title: `Study: ${openDoc.name}`, subjectTitle: openDoc.subjectName || "My Library", date: planDate || undefined, minutes: Number(planMinutes), type: planType }] },
      });
      toast({ title: r.message, description: "Your existing plan was not changed — this was added alongside it." });
    } catch (e) {
      toast({ title: "Could not add to planner", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addToRevision() {
    if (!openDoc) return;
    try {
      const r = await api<{ message?: string; duplicate?: boolean }>("/api/library/revision", {
        method: "POST",
        body: { action: "create", title: openDoc.name, subtitle: openDoc.subjectName || "My Study Library", docId: openDoc.id },
      });
      toast({ title: r.duplicate ? "Already scheduled ✓" : "Added to your revision schedule 🔁", description: r.message });
    } catch (e) {
      toast({ title: "Could not schedule", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  function openInQBank() {
    if (!openDoc) return;
    setQbankDocFilter(openDoc.id);
    setOpenDoc(null);
    setView("qbank");
  }

  const docIcons: Record<string, React.ReactNode> = {
    PDF: <FileText className="h-5 w-5" />,
    IMAGE: <ImageIcon className="h-5 w-5" />,
    TEXT: <StickyNote className="h-5 w-5" />,
  };

  const textStateBadge = (state: string) =>
    state === "READY" ? (
      <Badge className="bg-mint-soft text-teal-800 dark:text-teal-100 border-0 rounded-full text-[10px]">AI-ready text</Badge>
    ) : state === "EMPTY" ? (
      <Badge className="bg-peach-soft text-orange-900 dark:text-orange-100 border-0 rounded-full text-[10px]">scanned — OCR on request</Badge>
    ) : state === "FAILED" ? (
      <Badge variant="outline" className="rounded-full text-[10px]">text read failed</Badge>
    ) : (
      <Badge variant="outline" className="rounded-full text-[10px]">OCR on request</Badge>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Study Library"
        subtitle="Your own notes, question papers, answer sheets and textbook photos — private, searchable and AI-ready."
        icon={<LibraryBig className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setEditingFolder(null); setFolderName(""); setFolderParent("root"); setFolderOpen(true); }}>
              <FolderPlus className="h-4 w-4 mr-1.5" /> New folder
            </Button>
            <Button className="rounded-full" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Upload files
            </Button>
          </div>
        }
      />

      {/* Folders */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all" as const, label: `All files (${docs?.length ?? 0})` },
          { id: "root" as const, label: "Unfiled" },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setFolderId(c.id); setTag(null); }}
            className={cn("px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all", folderId === c.id ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:border-mint/60")}
            aria-pressed={folderId === c.id}
          >
            {c.label}
          </button>
        ))}
        <span className="h-5 w-px bg-border mx-1" aria-hidden />
        {rootFolders.map((f) => (
          <span key={f.id} className="relative inline-flex">
            <button
              type="button"
              onClick={() => setFolderId(f.id)}
              className={cn("pl-3.5 pr-7 py-1.5 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-1.5", folderId === f.id ? "bg-primary text-primary-foreground border-transparent" : "bg-card hover:border-mint/60")}
              aria-pressed={folderId === f.id}
            >
              <FolderInput className="h-3.5 w-3.5" /> {f.name} ({f._count.docs})
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted" aria-label={`Folder options for ${f.name}`}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => { setEditingFolder(f); setFolderName(f.name); setFolderParent(f.parentId ?? "root"); setFolderOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem className="text-rose-600 dark:text-rose-400" onClick={() => deleteFolder(f)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search names, tags, descriptions and content…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search your library" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All formats</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="IMAGE">Images</SelectItem>
            <SelectItem value="TEXT">Typed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={onlyBookmarked ? "default" : "outline"} size="sm" className="rounded-full h-10" onClick={() => setOnlyBookmarked((v) => !v)} aria-pressed={onlyBookmarked}>
          <Star className={cn("h-4 w-4 mr-1", onlyBookmarked && "fill-current")} /> Bookmarked
        </Button>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground mr-1">Tags:</span>
          {allTags.map((t) => (
            <button key={t} type="button" onClick={() => setTag(tag === t ? null : t)} className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all", tag === t ? "bg-lavender text-white border-transparent" : "bg-card hover:border-lavender/60")} aria-pressed={tag === t}>
              #{t}
            </button>
          ))}
          {tag ? <button type="button" onClick={() => setTag(null)} className="text-[11px] text-muted-foreground underline">clear</button> : null}
        </div>
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {/* Doc grid */}
      {!docs ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<LibraryBig className="h-6 w-6" />}
          title={q || tag || onlyBookmarked ? "Nothing matches those filters" : "Your library is empty"}
          description="Upload PDF notes, question papers, answer sheets, photos of textbook pages or handwritten notes — then let AI read and work with them."
          action={<Button className="rounded-full" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1.5" /> Upload your first files</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="rounded-xl card-hover overflow-hidden flex flex-col">
              <button type="button" className="text-left p-4 flex-1" onClick={() => openDetail(doc)} aria-label={`Open ${doc.name}`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary flex items-center justify-center text-teal-700 dark:text-teal-200">{docIcons[doc.kind]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{doc.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{CATEGORY_LABEL[doc.category] ?? doc.category} · {fmtSize(doc.size)}</p>
                  </div>
                </div>
                {doc.description ? <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.description}</p> : null}
                <div className="flex flex-wrap gap-1 mt-2">
                  {textStateBadge(doc.textState)}
                  {doc.subjectName ? <Badge variant="outline" className="rounded-full text-[10px]">{doc.subjectName}</Badge> : null}
                  {doc.examName ? <Badge className="bg-peach-soft text-orange-900 dark:text-orange-100 border-0 rounded-full text-[10px]">{doc.examName}</Badge> : null}
                  {(() => { try { return (JSON.parse(doc.tags) as string[]).slice(0, 2); } catch { return []; } })().map((t) => (
                    <Badge key={t} variant="outline" className="rounded-full text-[10px]">#{t}</Badge>
                  ))}
                  {doc._count.comments > 0 ? <Badge variant="outline" className="rounded-full text-[10px]">{doc._count.comments} notes</Badge> : null}
                </div>
              </button>
              <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={doc.bookmarked ? "Remove bookmark" : "Bookmark"} onClick={() => toggleBookmark(doc)}>
                  <Bookmark className={cn("h-3.5 w-3.5", doc.bookmarked && "fill-peach text-peach")} />
                </Button>
                <div className="flex gap-0.5">
                  <a href={`/api/library/file?id=${doc.id}&download=1`} download aria-label="Download file">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit details" onClick={() => openEdit(doc)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" aria-label="Delete file" onClick={() => deleteDoc(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Upload to your library</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer hover:border-mint/60 bg-muted/30 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)].slice(0, 10)); }}
            >
              <Upload className="h-6 w-6 text-mint" />
              <p className="text-sm font-bold">{files.length > 0 ? `${files.length} file(s) selected` : "Drop files here or click to browse"}</p>
              <p className="text-xs text-muted-foreground text-center">PDFs, photos of notes/textbooks, typed .txt/.md notes · up to 20 MB each, 10 at a time</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,image/*,.txt,.md" className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 10))} />
              {files.length > 0 ? (
                <ul className="w-full space-y-1 mt-1">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-xs bg-card rounded-lg border px-2.5 py-1.5">
                      <span className="truncate">{f.name} · {fmtSize(f.size)}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); setFiles((arr) => arr.filter((_, j) => j !== i)); }} aria-label={`Remove ${f.name}`}><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <Select value={upCategory} onValueChange={setUpCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Folder</Label>
                <Select value={upFolder} onValueChange={setUpFolder}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Unfiled</SelectItem>
                    {rootFolders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={upSubject} onChange={(e) => setUpSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
              <div className="space-y-1"><Label className="text-xs">Chapter</Label><Input value={upChapter} onChange={(e) => setUpChapter(e.target.value)} placeholder="e.g. Chapter 3" /></div>
              <div className="space-y-1"><Label className="text-xs">Topic</Label><Input value={upTopic} onChange={(e) => setUpTopic(e.target.value)} placeholder="optional" /></div>
              <div className="space-y-1"><Label className="text-xs">Exam</Label><Input value={upExam} onChange={(e) => setUpExam(e.target.value)} placeholder="e.g. Midterm 2026" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={2} value={upDesc} onChange={(e) => setUpDesc(e.target.value)} placeholder="What is this? e.g. Unit 4 handwritten notes" /></div>
            <div className="space-y-1"><Label className="text-xs">Tags (comma separated)</Label><Input value={upTags} onChange={(e) => setUpTags(e.target.value)} placeholder="important, unit-4, derivations" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button className="rounded-full" onClick={upload} disabled={uploading || files.length === 0}>
              {uploading ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading & reading…</>) : (<>Upload {files.length > 0 ? files.length : ""}</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder dialog */}
      <Dialog open={folderOpen} onOpenChange={(o) => { setFolderOpen(o); if (!o) setEditingFolder(null); }}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader><DialogTitle>{editingFolder ? "Rename folder" : "New folder"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label className="text-xs">Folder name</Label><Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Physics · Unit 4" /></div>
            {!editingFolder ? (
              <div className="space-y-1"><Label className="text-xs">Inside</Label>
                <Select value={folderParent} onValueChange={setFolderParent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Top level</SelectItem>
                    {rootFolders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter><Button className="rounded-full" onClick={saveFolder} disabled={!folderName.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit details dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent className="rounded-xl max-w-lg max-h-[90vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Edit details</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Folder</Label>
                <Select value={editForm.folderId} onValueChange={(v) => setEditForm({ ...editForm, folderId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Unfiled</SelectItem>
                    {rootFolders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Subject</Label><Input value={editForm.subjectName} onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Chapter</Label><Input value={editForm.chapterName} onChange={(e) => setEditForm({ ...editForm, chapterName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Topic</Label><Input value={editForm.topicName} onChange={(e) => setEditForm({ ...editForm, topicName: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Exam</Label><Input value={editForm.examName} onChange={(e) => setEditForm({ ...editForm, examName: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Tags (comma separated)</Label><Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} /></div>
          </div>
          <DialogFooter><Button className="rounded-full" onClick={saveEdit}>Save changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!openDoc} onOpenChange={(o) => !o && setOpenDoc(null)}>
        <DialogContent className="rounded-xl max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col">
          {openDoc ? (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
                  <span className="truncate">{openDoc.name}</span>
                  {textStateBadge(detail?.textState ?? openDoc.textState)}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{CATEGORY_LABEL[openDoc.category] ?? openDoc.category} · {fmtSize(openDoc.size)}</span>
                  {openDoc.subjectName ? <span>· {openDoc.subjectName}</span> : null}
                  {openDoc.chapterName ? <span>· {openDoc.chapterName}</span> : null}
                  {openDoc.topicName ? <span>· {openDoc.topicName}</span> : null}
                </div>
              </DialogHeader>

              <Tabs defaultValue="read" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="shrink-0 w-full justify-start overflow-x-auto scroll-soft">
                  <TabsTrigger value="read"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Read</TabsTrigger>
                  <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1.5" />AI tools</TabsTrigger>
                  <TabsTrigger value="notes"><Highlighter className="h-3.5 w-3.5 mr-1.5" />Highlights ({comments.length})</TabsTrigger>
                  <TabsTrigger value="plan"><CalendarPlus className="h-3.5 w-3.5 mr-1.5" />Plan</TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-y-auto scroll-soft pr-1 mt-3">
                  {/* READ */}
                  <TabsContent value="read" className="mt-0 space-y-3">
                    {openDoc.kind === "TEXT" ? (
                      <div className="rounded-xl border p-4 whitespace-pre-wrap text-sm max-h-[60vh] overflow-y-auto scroll-soft" onMouseUp={captureSelection}>{detail?.text || "This file has no text content."}</div>
                    ) : readMode === "file" ? (
                      <div className="space-y-2">
                        {openDoc.kind === "PDF" ? (
                          <iframe title={`Preview of ${openDoc.name}`} src={`/api/library/file?id=${openDoc.id}`} className="w-full h-[58vh] rounded-xl border bg-white" />
                        ) : (
                          <img src={`/api/library/file?id=${openDoc.id}`} alt={openDoc.name} className="max-h-[58vh] w-auto mx-auto rounded-xl border" />
                        )}
                        <div className="flex justify-center">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReadMode("text")}>
                            <FileText className="h-3.5 w-3.5 mr-1" /> Open extracted text (selectable for highlights)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          className="rounded-xl border p-4 text-sm leading-relaxed max-h-[55vh] overflow-y-auto scroll-soft select-text whitespace-pre-wrap"
                          onMouseUp={captureSelection}
                        >
                          {detail?.text || detail?.textNote || "No text extracted yet — press “Read with AI” in the AI tools tab."}
                        </div>
                        {selection ? (
                          <div className="flex items-center gap-2 text-xs rounded-lg border border-mint/50 bg-mint-soft/40 dark:bg-mint-soft/10 p-2.5">
                            <Highlighter className="h-3.5 w-3.5 text-mint shrink-0" />
                            <span className="truncate flex-1">“{selection.slice(0, 80)}{selection.length > 80 ? "…" : ""}” selected — it will be quoted in your highlight.</span>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelection("")} aria-label="Clear selection"><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : null}
                        <div className="flex justify-center">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReadMode("file")}>
                            <BookOpen className="h-3.5 w-3.5 mr-1" /> Back to {openDoc.kind === "PDF" ? "PDF" : "image"} view
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{detail?.textNote || openDoc.textNote}</p>
                  </TabsContent>

                  {/* AI TOOLS */}
                  <TabsContent value="ai" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "summarize", label: "Summarise", icon: <BookOpen className="h-4 w-4" /> },
                        { id: "explain", label: "Explain simply", icon: <Sparkles className="h-4 w-4" /> },
                        { id: "keypoints", label: "Important points", icon: <Star className="h-4 w-4" /> },
                        { id: "questions", label: "Make questions", icon: <FileQuestion className="h-4 w-4" /> },
                        { id: "flashcards", label: "Flashcards", icon: <Layers className="h-4 w-4" /> },
                        { id: "quiz", label: "Quiz me", icon: <ListChecks className="h-4 w-4" /> },
                      ].map((a) => (
                        <Button key={a.id} variant="outline" className="rounded-xl h-auto py-2.5 flex-col gap-1" onClick={() => runAi(a.id)} disabled={busyAction !== null}>
                          {busyAction === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : a.icon}
                          <span className="text-xs font-bold">{a.label}</span>
                        </Button>
                      ))}
                    </div>
                    {busyAction && busyAction !== "ask" ? <AIRunning label={`AI is working on “${busyAction}”… big documents can take a moment.`} /> : null}

                    {/* Summarise */}
                    {typeof detail?.results.summarize === "string" ? (
                      <Card className="rounded-xl border-mint/40 bg-mint-soft/30 dark:bg-mint-soft/10">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-extrabold">📖 Easy-to-understand notes</p>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="ghost" className="rounded-full h-7 text-xs" onClick={() => downloadTextFile(`${openDoc.name} — summary.md`, detail.results.summarize as string, "text/markdown")}>Download</Button>
                              <Button size="sm" variant="ghost" className="rounded-full h-7 text-xs" onClick={() => api("/api/notes", { method: "POST", body: { title: `${openDoc.name} — summary`, content: detail.results.summarize } }).then(() => toast({ title: "Saved to your notes 💾" })).catch(() => toast({ title: "Could not save note", variant: "destructive" }))}>Save as note</Button>
                            </div>
                          </div>
                          <Markdown>{detail.results.summarize as string}</Markdown>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Explain */}
                    {typeof detail?.results.explain === "string" ? (
                      <Card className="rounded-xl border-lavender/40 bg-lavender-soft/30 dark:bg-lavender-soft/10">
                        <CardContent className="pt-4 space-y-1">
                          <p className="text-sm font-extrabold">🫧 Simple explanation</p>
                          <Markdown>{detail.results.explain as string}</Markdown>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Key points */}
                    {detail?.results.keypoints ? (() => {
                      const kp = detail.results.keypoints as Keypoints;
                      return (
                        <Card className="rounded-xl">
                          <CardContent className="pt-4 space-y-3">
                            <p className="text-sm font-extrabold">⭐ Important definitions, formulas & concepts</p>
                            {kp.keyPoints?.length ? (
                              <ul className="space-y-1">{kp.keyPoints.map((k, i) => <li key={i} className="text-sm flex gap-2"><span className="text-mint font-extrabold">•</span><span>{k}</span></li>)}</ul>
                            ) : null}
                            {kp.definitions?.length ? (
                              <div className="grid sm:grid-cols-2 gap-2">
                                {kp.definitions.map((d, i) => (
                                  <div key={i} className="rounded-lg border p-2.5"><p className="font-bold text-sm">{d.term}</p><p className="text-xs text-muted-foreground mt-0.5">{d.meaning}</p></div>
                                ))}
                              </div>
                            ) : null}
                            {kp.formulas?.length ? (
                              <div className="space-y-1.5">
                                {kp.formulas.map((f, i) => (
                                  <div key={i} className="rounded-lg bg-muted/60 p-2.5"><p className="font-bold text-sm">{f.name}</p><p className="font-mono text-xs mt-0.5">{f.expression}</p></div>
                                ))}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })() : null}

                    {/* Generated questions (+ optional answers) */}
                    {Array.isArray(detail?.results.questions) ? (() => {
                      const qs = detail.results.questions as GenQuestions;
                      const answers = (detail.results.answers as { question: string; answer: string }[] | undefined) ?? [];
                      return (
                        <Card className="rounded-xl">
                          <CardContent className="pt-4 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-extrabold">📝 {qs.length} questions from this document</p>
                              <div className="flex gap-1.5">
                                {answers.length === 0 ? (
                                  <Button size="sm" variant="outline" className="rounded-full h-7 text-xs" onClick={generateAnswersForExtracted} disabled={busyAction !== null}>Generate answers</Button>
                                ) : null}
                                <Button size="sm" className="rounded-full h-7 text-xs" onClick={() => saveQuestionsToBank(answers.length > 0)}>
                                  Save {answers.length > 0 ? "with AI answers" : "to Q&A Bank"}
                                </Button>
                              </div>
                            </div>
                            {qs.map((x, i) => (
                              <div key={i} className="rounded-lg border p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold flex-1">{i + 1}. {x.question}</p>
                                  <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full text-[10px] shrink-0">{x.marks} marks</Badge>
                                </div>
                                {answers.find((a) => a.question === x.question)?.answer ? (
                                  <p className="text-xs text-muted-foreground mt-1.5 border-l-2 border-lavender pl-2">AI answer: {answers.find((a) => a.question === x.question)!.answer.slice(0, 300)}</p>
                                ) : x.answerHint ? (
                                  <p className="text-xs text-muted-foreground mt-1.5">Hint: {x.answerHint}</p>
                                ) : null}
                              </div>
                            ))}
                            <p className="text-[11px] text-muted-foreground">Saved AI answers are stored as clearly-labelled drafts in My Q&amp;A Bank — your own answers always stay separate.</p>
                          </CardContent>
                        </Card>
                      );
                    })() : null}

                    {/* Flashcards */}
                    {Array.isArray(detail?.results.flashcards) ? (() => {
                      const cards = detail.results.flashcards as Flashcards;
                      return <FlashcardGrid cards={cards} />;
                    })() : null}

                    {/* Ask AI */}
                    <Card className="rounded-xl">
                      <CardContent className="pt-4 space-y-2.5">
                        <p className="text-sm font-extrabold">💬 Ask AI about this document</p>
                        {askThread.map((f, i) => (
                          <div key={i} className="rounded-lg border p-2.5 space-y-1">
                            <p className="text-sm font-bold">Q: {f.q}</p>
                            <Markdown>{f.a}</Markdown>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input placeholder="e.g. What does the third question ask?" value={askInput} onChange={(e) => setAskInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
                          <Button className="rounded-full shrink-0" onClick={ask} disabled={busyAction !== null || !askInput.trim()}>Ask</Button>
                        </div>
                        {busyAction === "ask" ? <AIRunning label="Reading the document for your answer…" /> : null}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* HIGHLIGHTS */}
                  <TabsContent value="notes" className="mt-0 space-y-3">
                    <Card className="rounded-xl">
                      <CardContent className="pt-4 space-y-2.5">
                        <p className="text-sm font-extrabold">Add a highlight or comment</p>
                        {selection ? (
                          <div className={cn("rounded-lg p-2.5 text-xs", HIGHLIGHT_COLORS[commentColor])}>“{selection}”</div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Tip: switch to the extracted-text view in the Read tab and select a sentence to quote it here. Questions and important lines are perfect for this.</p>
                        )}
                        <Textarea rows={2} placeholder="Your comment — why is this important? What to remember?" value={commentNote} onChange={(e) => setCommentNote(e.target.value)} />
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex gap-1">
                            {Object.keys(HIGHLIGHT_COLORS).map((c) => (
                              <button key={c} type="button" onClick={() => setCommentColor(c)} className={cn("h-6 w-6 rounded-full border-2", HIGHLIGHT_COLORS[c], commentColor === c ? "border-foreground" : "border-transparent")} aria-label={`Use ${c} highlight`} />
                            ))}
                          </div>
                          <Input type="number" min={1} className="w-24" placeholder="Page" value={commentPage} onChange={(e) => setCommentPage(e.target.value)} aria-label="Page number (optional)" />
                          <Button className="rounded-full ml-auto" size="sm" onClick={addComment}><MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Save</Button>
                        </div>
                      </CardContent>
                    </Card>
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No highlights yet.</p>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className={cn("rounded-xl border p-3 space-y-1.5", HIGHLIGHT_COLORS[c.color])}>
                          {c.quote ? <p className="text-sm font-semibold">“{c.quote}”</p> : null}
                          {c.note ? <p className="text-sm">{c.note}</p> : null}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{c.page ? `Page ${c.page} · ` : ""}{new Date(c.createdAt).toLocaleDateString()}</span>
                            <button type="button" onClick={() => deleteComment(c.id)} className="underline hover:text-rose-500">remove</button>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* PLAN */}
                  <TabsContent value="plan" className="mt-0 space-y-3">
                    <Card className="rounded-xl">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-sm font-extrabold">Add this document to your study plan</p>
                        <p className="text-xs text-muted-foreground">This appends a session to your existing planner on the date you choose — nothing in your current plan is changed or regenerated.</p>
                        <div className="grid sm:grid-cols-3 gap-2">
                          <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Session type</Label>
                            <Select value={planType} onValueChange={setPlanType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="LEARN">Learn</SelectItem><SelectItem value="REVISE">Revise</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1"><Label className="text-xs">Minutes</Label>
                            <Select value={planMinutes} onValueChange={setPlanMinutes}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{[15, 30, 45, 60, 90, 120].map((m) => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button className="rounded-full" onClick={addToPlanner}><CalendarPlus className="h-4 w-4 mr-1.5" /> Add to planner</Button>
                      </CardContent>
                    </Card>
                    <Card className="rounded-xl">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-sm font-extrabold">Spaced revision</p>
                        <p className="text-xs text-muted-foreground">Adds this document to your revision schedule with the standard 1 · 3 · 7 · 14 · 30 day ladder.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="rounded-full" onClick={addToRevision}><Repeat2 className="h-4 w-4 mr-1.5" /> Add to revision schedule</Button>
                          {openDoc.category === "question_paper" || openDoc.category === "notes" ? (
                            <Button variant="outline" className="rounded-full" onClick={openInQBank}><FileQuestion className="h-4 w-4 mr-1.5" /> Open its questions in My Q&amp;A Bank</Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>

              <div className="flex items-center justify-between gap-2 pt-3 border-t shrink-0">
                <div className="flex gap-1.5">
                  <a href={`/api/library/file?id=${openDoc.id}&download=1`} download>
                    <Button variant="outline" size="sm" className="rounded-full"><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                  </a>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => toggleBookmark(openDoc)}>
                    <Bookmark className={cn("h-3.5 w-3.5 mr-1", openDoc.bookmarked && "fill-peach text-peach")} /> {openDoc.bookmarked ? "Bookmarked" : "Bookmark"}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full text-rose-500" onClick={() => deleteDoc(openDoc)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={!!quiz} onOpenChange={(o) => !o && setQuiz(null)}>
        <DialogContent className="rounded-xl max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
          <DialogHeader><DialogTitle>Quiz from “{openDoc?.name}”</DialogTitle></DialogHeader>
          {quiz ? <QuizRunner quizId={quiz.quizId} questions={quiz.questions} title="Answer from what you read — results feed your streak." /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlashcardGrid({ cards }: { cards: Flashcards }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  if (cards.length === 0) return null;
  return (
    <Card className="rounded-xl">
      <CardContent className="pt-4">
        <p className="text-sm font-extrabold mb-2.5">🃏 Revision flashcards — tap to flip</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {cards.map((fc, i) => (
            <button key={i} type="button" onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} className="min-h-24 rounded-xl border p-3 text-left bg-card hover:shadow-md transition-shadow" aria-pressed={flipped[i]}>
              {flipped[i] ? <p className="text-sm">{fc.back}</p> : <p className="text-sm font-bold">{fc.front}</p>}
              <p className="text-[10px] text-muted-foreground mt-2.5 uppercase tracking-wide">{flipped[i] ? "Answer · tap to flip back" : "Question · tap to reveal"}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
