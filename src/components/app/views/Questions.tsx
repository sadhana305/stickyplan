"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { downloadTextFile } from "@/lib/client";
import { PenLine, Sparkles, Printer, Download, History, Trash2, FileText } from "lucide-react";

type Subject = { id: string; name: string; chapters: { id: string; name: string; topics: { id: string; name: string }[] }[] };
type GenQuestion = {
  type: string;
  marks: number;
  question: string;
  options?: string[] | null;
  answer: string;
  keywords: string[];
  structure: string;
  example: string;
};
type SetMeta = { id: string; title: string; createdAt: string; params: { marks?: number[]; types?: string[]; scopeLabel?: string } };

const TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  VERY_SHORT: "Very short answer",
  SHORT: "Short answer",
  LONG: "Long answer",
  DESCRIPTIVE: "Descriptive",
  NUMERICAL: "Numerical problem",
  APPLICATION: "Application-based",
};
const MARK_OPTIONS = [1, 2, 5, 10, 13, 16];
const ALL_TYPES = Object.keys(TYPE_LABELS);

export function QuestionGenView() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [sets, setSets] = useState<SetMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState("topic");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [marks, setMarks] = useState<number[]>([2, 5]);
  const [customMark, setCustomMark] = useState("");
  const [types, setTypes] = useState<string[]>(["MCQ", "SHORT", "LONG"]);
  const [count, setCount] = useState(6);

  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<GenQuestion[] | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperCounts, setPaperCounts] = useState<Record<number, number>>({ 1: 10, 2: 5, 5: 4, 10: 2 });

  const load = useCallback(() => {
    setError(null);
    Promise.all([api<{ subjects: Subject[] }>("/api/subjects"), api<{ sets: SetMeta[] }>("/api/question-sets")])
      .then(([s, q]) => {
        setSubjects(s.subjects);
        setSets(q.sets);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load question generator."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const chapters = subjects?.find((s) => s.id === subjectId)?.chapters ?? [];
  const topics = chapters.find((c) => c.id === chapterId)?.topics ?? [];

  async function generate() {
    setGenerating(true);
    setQuestions(null);
    try {
      const body: Record<string, unknown> = { marks, types, count };
      if (scope === "topic" && topicId) body.topicId = topicId;
      else if (scope === "chapter" && chapterId) body.chapterId = chapterId;
      else if (subjectId) body.subjectId = subjectId;
      const r = await api<{ questions: GenQuestion[] }>("/api/questions/generate", { method: "POST", body });
      setQuestions(r.questions);
      toast({ title: "Questions ready 📝", description: `${r.questions.length} questions with model answers.` });
      load();
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function generatePaper() {
    setPaperOpen(false);
    setGenerating(true);
    setQuestions(null);
    try {
      const allMarks = Object.entries(paperCounts).filter(([, c]) => c > 0).map(([m]) => Number(m));
      const body: Record<string, unknown> = {
        marks: allMarks.length ? allMarks : [2, 5],
        types: ["MCQ", "VERY_SHORT", "SHORT", "LONG", "DESCRIPTIVE", "NUMERICAL", "APPLICATION"],
        count: Math.min(15, Object.values(paperCounts).reduce((a, b) => a + b, 0)),
      };
      if (scope === "topic" && topicId) body.topicId = topicId;
      else if (scope === "chapter" && chapterId) body.chapterId = chapterId;
      else if (subjectId) body.subjectId = subjectId;
      const r = await api<{ questions: GenQuestion[] }>("/api/questions/generate", { method: "POST", body });
      setQuestions(r.questions);
      setShowAnswers(false);
      toast({ title: "Practice paper generated 🎓", description: "Print it or download — answer key included below." });
      load();
    } catch (e) {
      toast({ title: "Could not build the paper", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function viewSet(id: string) {
    try {
      const r = await api<{ set: { questions: GenQuestion[] } }>(`/api/question-sets?id=${id}`);
      setQuestions(r.set.questions);
      setShowAnswers(true);
    } catch (e) {
      toast({ title: "Could not open set", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function deleteSet(id: string) {
    try {
      await api(`/api/question-sets?id=${id}`, { method: "DELETE" });
      load();
    } catch {
      /* ignore */
    }
  }

  function paperText(qs: GenQuestion[]): string {
    const lines = ["PRACTICE QUESTION PAPER", "=======================", ""];
    qs.forEach((q, i) => {
      lines.push(`Q${i + 1}. [${q.marks} mark${q.marks > 1 ? "s" : ""}] ${q.type}`);
      lines.push(q.question);
      if (q.options) q.options.forEach((o) => lines.push(`   ${o}`));
      lines.push("");
      lines.push(`Answer (expected): ${q.answer}`);
      lines.push(`Keywords: ${q.keywords.join(", ")}`);
      lines.push(`Structure: ${q.structure}`);
      if (q.example) lines.push(`Example: ${q.example}`);
      lines.push("", "----------------------------------------", "");
    });
    return lines.join("\n");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Question Generator" subtitle="Exam-oriented questions with model answers — any mark scheme." icon={<PenLine className="h-5 w-5" />} />

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold flex items-center gap-2"><Sparkles className="h-4.5 w-4.5 text-mint" /> Configure your questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-2">
            <Select value={scope} onValueChange={(v) => { setScope(v); setChapterId(""); setTopicId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="topic">By topic</SelectItem>
                <SelectItem value="chapter">By chapter</SelectItem>
                <SelectItem value="subject">By subject</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); setTopicId(""); }}>
              <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>{(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {scope !== "subject" ? (
              <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId(""); }} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
                <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : <div />}
            {scope === "topic" ? (
              <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
                <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
                <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : <div />}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Mark categories</Label>
              <div className="flex flex-wrap gap-2">
                {MARK_OPTIONS.map((m) => (
                  <label key={m} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold cursor-pointer has-[:checked]:bg-mint has-[:checked]:text-white has-[:checked]:border-mint transition-colors">
                    <Checkbox checked={marks.includes(m)} onCheckedChange={(c) => setMarks((ms) => (c ? [...ms, m] : ms.filter((x) => x !== m)))} className="sr-only" />
                    {m} marks
                  </label>
                ))}
                <div className="flex items-center gap-1">
                  <Input className="h-9 w-20 rounded-full" type="number" min={1} max={25} placeholder="Custom" value={customMark} onChange={(e) => setCustomMark(e.target.value)} />
                  <Button size="sm" variant="outline" className="rounded-full h-9" onClick={() => { const n = Number(customMark); if (n >= 1 && n <= 25 && !marks.includes(n)) { setMarks((ms) => [...ms, n]); setCustomMark(""); } }}>Add</Button>
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Question types</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold cursor-pointer has-[:checked]:bg-lavender has-[:checked]:text-white has-[:checked]:border-lavender transition-colors">
                    <Checkbox checked={types.includes(t)} onCheckedChange={(c) => setTypes((ts) => (c ? [...ts, t] : ts.filter((x) => x !== t)))} className="sr-only" />
                    {TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">How many:</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="w-24 rounded-full"><SelectValue /></SelectTrigger>
                <SelectContent>{[3, 5, 6, 8, 10, 12, 15].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="rounded-full" disabled={generating || marks.length === 0 || types.length === 0 || (scope === "topic" ? !topicId : scope === "chapter" ? !chapterId : !subjectId)} onClick={generate}>
              <Sparkles className="h-4 w-4 mr-1.5" /> Generate questions
            </Button>
            <Button variant="outline" className="rounded-full" disabled={generating || (scope === "topic" ? !topicId : scope === "chapter" ? !chapterId : !subjectId)} onClick={() => setPaperOpen(true)}>
              <FileText className="h-4 w-4 mr-1.5" /> Full practice paper
            </Button>
          </div>
          {generating ? <AIRunning label="Writing exam-style questions with model answers…" /> : null}
        </CardContent>
      </Card>

      {questions ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-extrabold">{showAnswers ? "Questions & model answers" : "Practice paper"}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowAnswers((s) => !s)}>
                  {showAnswers ? "Hide answers" : "Show answers"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadTextFile("practice-paper.txt", paperText(questions))}><Download className="h-4 w-4 mr-1" /> Download</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-sm flex-1">{i + 1}. {q.question}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                    <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full text-[10px]">{q.marks} marks</Badge>
                  </div>
                </div>
                {q.options && showAnswers === false ? (
                  <div className="mt-2 grid sm:grid-cols-2 gap-1.5">
                    {q.options.map((o, j) => <p key={j} className="text-sm text-muted-foreground">{o}</p>)}
                  </div>
                ) : null}
                {showAnswers ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3">
                    {q.options ? (
                      <p className="text-xs text-muted-foreground">Options: {q.options.join(" · ")}</p>
                    ) : null}
                    <p className="text-sm"><span className="font-extrabold text-mint">Model answer: </span>{q.answer}</p>
                    {q.keywords?.length ? <p className="text-xs text-muted-foreground"><b>Keywords:</b> {q.keywords.join(", ")}</p> : null}
                    {q.structure ? <p className="text-xs text-muted-foreground"><b>Answer structure:</b> {q.structure}</p> : null}
                    {q.example ? <p className="text-xs text-muted-foreground"><b>Example:</b> {q.example}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<PenLine className="h-6 w-6" />} title="No questions generated yet" description="Pick a scope and mark categories above. Great for last-minute revision or mock practice." />
      )}

      {/* History */}
      {sets.length > 0 ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold flex items-center gap-2"><History className="h-4.5 w-4.5 text-muted-foreground" /> Previous sets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {sets.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()} · {s.params.marks?.join("/") ?? ""} marks</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => viewSet(s.id)}>Open</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Delete set" onClick={() => deleteSet(s.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Paper composition dialog */}
      <Dialog open={paperOpen} onOpenChange={setPaperOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>Practice paper composition</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Choose how many questions of each mark value. The AI builds a mixed paper within your syllabus.</p>
          <div className="space-y-2 py-2 max-h-72 overflow-y-auto scroll-soft pr-1">
            {[1, 2, 5, 10, 13, 16, ...marks.filter((m) => ![1, 2, 5, 10, 13, 16].includes(m))].filter((m, i, arr) => arr.indexOf(m) === i).map((m) => (
              <div key={m} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label className="text-sm font-bold">{m} marks</Label>
                <Select value={String(paperCounts[m] ?? 0)} onValueChange={(v) => setPaperCounts((c) => ({ ...c, [m]: Number(v) }))}>
                  <SelectTrigger className="w-20 rounded-full h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? "skip" : n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter><Button className="rounded-full" onClick={generatePaper}>Build paper 🎓</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
