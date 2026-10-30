"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { useApp } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ListChecks, Sparkles, Timer, CheckCircle2, XCircle, RotateCcw, Brain } from "lucide-react";

type Q = {
  id: string;
  type: string;
  topicId: string | null;
  topicName: string;
  question: string;
  options?: string[];
  left?: string[];
  right?: string[];
};
type Result = {
  id: string;
  type: string;
  topicName: string;
  given: string;
  expected: string;
  correct: number;
  explanation: string;
  feedback?: string;
};
type Subject = { id: string; name: string; chapters: { id: string; name: string; topics: { id: string; name: string }[] }[] };

const TYPE_LABEL: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True or false",
  FILL_BLANK: "Fill in the blank",
  MATCH: "Match the following",
  SHORT: "Short answer",
  APPLICATION: "Application-based",
};

export function QuizView() {
  const { toast } = useToast();
  const setUnread = useApp((s) => s.setUnread);
  const [scope, setScope] = useState<"today" | "custom">("today");
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; accuracy: number; results: Result[] } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<{ subjects: Subject[] }>("/api/subjects").then((r) => setSubjects(r.subjects)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (startedAt !== null && timerRef.current === null) {
      timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [startedAt]);

  const chapters = subjects?.find((s) => s.id === subjectId)?.chapters ?? [];

  async function start() {
    setGenerating(true);
    setError(null);
    setResults(null);
    setAnswers({});
    try {
      const body: Record<string, unknown> = scope === "today" ? { scope: "today" } : { scope: "custom" };
      if (scope === "custom") {
        if (chapterId) body.chapterId = chapterId;
        else if (subjectId) body.subjectId = subjectId;
        else throw new Error("Pick a subject or chapter first.");
      }
      const r = await api<{ quizId: string; questions: Q[] }>("/api/quiz/generate", { method: "POST", body });
      setQuizId(r.quizId);
      setQuestions(r.questions);
      setStartedAt(Date.now());
      setElapsed(0);
      toast({ title: "Quiz ready! Good luck 🍀", description: `${r.questions.length} questions from your topics.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the quiz.");
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    if (!quizId) return;
    const unanswered = (questions ?? []).filter((q) => !answers[q.id] || !answers[q.id].trim());
    if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) are unanswered. Submit anyway?`)) return;
    setSubmitting(true);
    try {
      const r = await api<{ score: number; total: number; accuracy: number; results: Result[] }>("/api/quiz/submit", {
        method: "POST",
        body: { quizId, answers, timeSec: elapsed },
      });
      setResults(r);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      api<{ unread: number }>("/api/notifications").then((n) => setUnread(n.unread)).catch(() => undefined);
      toast({ title: `Scored ${Math.round(r.score)}/${r.total} (${r.accuracy}%)`, description: r.accuracy >= 80 ? "Brilliant! 🌟" : "Check the explanations below." });
    } catch (e) {
      toast({ title: "Submit failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = useMemo(() => (questions ?? []).filter((q) => (answers[q.id] ?? "").trim().length > 0).length, [answers, questions]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Quiz"
        subtitle="Questions from today's scheduled topics — accuracy feeds your revisions and streak."
        icon={<ListChecks className="h-5 w-5" />}
        action={
          startedAt !== null && !results ? (
            <Badge variant="outline" className="rounded-full px-3 py-1.5 font-mono text-sm"><Timer className="h-3.5 w-3.5 mr-1" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</Badge>
          ) : undefined
        }
      />

      {!questions ? (
        <Card className="rounded-xl">
          <CardContent className="pt-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-2">
              <button type="button" onClick={() => setScope("today")} className={cn("rounded-xl border p-4 text-left transition-all", scope === "today" ? "border-mint bg-mint-soft/60" : "hover:border-mint/50")} aria-pressed={scope === "today"}>
                <p className="font-extrabold text-sm">Today's topics</p>
                <p className="text-xs text-muted-foreground mt-0.5">From your plan (or due revisions)</p>
              </button>
              <button type="button" onClick={() => setScope("custom")} className={cn("rounded-xl border p-4 text-left transition-all", scope === "custom" ? "border-mint bg-mint-soft/60" : "hover:border-mint/50")} aria-pressed={scope === "custom"}>
                <p className="font-extrabold text-sm">Custom quiz</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pick any subject or chapter</p>
              </button>
              <div className="hidden sm:block" />
            </div>
            {scope === "custom" ? (
              <div className="grid sm:grid-cols-2 gap-2">
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                  <SelectContent>{(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
                  <SelectTrigger><SelectValue placeholder="Chapter (optional)" /></SelectTrigger>
                  <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}
            <Button className="rounded-full" onClick={start} disabled={generating || (scope === "custom" && !subjectId)}>
              <Sparkles className="h-4 w-4 mr-1.5" /> {generating ? "Creating your quiz…" : "Start quiz"}
            </Button>
            {generating ? <AIRunning label="Picking today's topics and writing questions…" /> : null}
            {error ? <ErrorState message={error} onRetry={start} /> : null}
          </CardContent>
        </Card>
      ) : results ? (
        <QuizResults results={results} onNewQuiz={() => { setQuestions(null); setResults(null); setQuizId(null); setAnswers({}); setStartedAt(null); }} />
      ) : (
        <>
          <Card className="rounded-xl sticky top-16 z-30 bg-card/95 backdrop-blur">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} className="flex-1" />
                <span className="text-sm font-bold whitespace-nowrap">{answeredCount}/{questions.length} answered</span>
                <Button className="rounded-full h-9" onClick={submit} disabled={submitting}>
                  {submitting ? "Grading…" : "Submit quiz"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                value={answers[q.id] ?? ""}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            ))}
            <div className="flex justify-end">
              <Button className="rounded-full px-8" onClick={submit} disabled={submitting}>{submitting ? "Grading…" : "Submit quiz"}</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function QuestionCard({ q, index, value, onChange }: { q: Q; index: number; value: string; onChange: (v: string) => void }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABEL[q.type] ?? q.type}</Badge>
          <span className="text-xs text-muted-foreground truncate">{q.topicName}</span>
        </div>
        <CardTitle className="text-sm font-bold leading-relaxed pt-1">{index + 1}. {q.question}</CardTitle>
      </CardHeader>
      <CardContent>
        {q.type === "MCQ" || q.type === "TRUE_FALSE" ? (
          <RadioGroup value={value} onValueChange={onChange} className="grid sm:grid-cols-2 gap-2">
            {(q.type === "TRUE_FALSE" ? ["True", "False"] : q.options ?? []).map((opt) => (
              <label key={opt} className={cn("flex items-center gap-2 rounded-lg border p-3 cursor-pointer text-sm font-semibold transition-colors", value === opt ? "border-mint bg-mint-soft/60" : "hover:border-mint/50")}>
                <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                <span>{opt}</span>
              </label>
            ))}
          </RadioGroup>
        ) : q.type === "MATCH" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Choose the matching pair for each item.</p>
            {(q.left ?? []).map((leftItem, li) => {
              const current = (() => {
                try {
                  return (JSON.parse(value || "{}") as Record<string, string>)[String(li)] ?? "";
                } catch {
                  return "";
                }
              })();
              return (
                <div key={li} className="flex items-center gap-2">
                  <span className="text-sm font-bold w-40 truncate">{leftItem}</span>
                  <Select
                    value={current}
                    onValueChange={(v) => {
                      try {
                        const map = JSON.parse(value || "{}") as Record<string, string>;
                        map[String(li)] = v;
                        onChange(JSON.stringify(map));
                      } catch {
                        onChange(JSON.stringify({ [String(li)]: v }));
                      }
                    }}
                  >
                    <SelectTrigger className="w-56"><SelectValue placeholder="Match…" /></SelectTrigger>
                    <SelectContent>{(q.right ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        ) : q.type === "FILL_BLANK" ? (
          <Input placeholder="Type your answer…" value={value} onChange={(e) => onChange(e.target.value)} className="max-w-sm" />
        ) : (
          <Textarea rows={3} placeholder="Write your answer (graded by AI against the model answer)…" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </CardContent>
    </Card>
  );
}

function QuizResults({ results, onNewQuiz }: { results: { score: number; total: number; accuracy: number; results: Result[] }; onNewQuiz: () => void }) {
  return (
    <div className="space-y-4 animate-fade-up">
      <Card className="rounded-xl text-center border-mint/40 bg-gradient-to-br from-mint-soft/50 to-transparent">
        <CardContent className="py-8">
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Your score</p>
          <p className="text-5xl font-extrabold mt-2 brand-gradient">{Math.round(results.score * 10) / 10}<span className="text-2xl text-foreground">/{results.total}</span></p>
          <p className="mt-2 text-lg font-bold">{results.accuracy}% accuracy</p>
          <p className="text-sm text-muted-foreground mt-1">
            {results.accuracy >= 80 ? "Excellent — you're exam ready on these topics! 🌟" : results.accuracy >= 50 ? "Good — weak topics were added to your Revision Centre." : "Tough round — revisit these topics with the AI Tutor and try again tomorrow."}
          </p>
          <Button variant="outline" className="rounded-full mt-4" onClick={onNewQuiz}><RotateCcw className="h-4 w-4 mr-1.5" /> New quiz</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {results.results.map((r, i) => (
          <Card key={r.id} className={cn("rounded-xl border", r.correct >= 0.99 ? "border-mint/40" : r.correct >= 0.5 ? "border-lemon/50" : "border-rose-300 dark:border-rose-800")}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm flex-1">{i + 1}. {r.topicName}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.correct >= 0.99 ? <Badge className="bg-mint text-white border-0 rounded-full"><CheckCircle2 className="h-3 w-3 mr-1" /> Correct</Badge>
                    : r.correct >= 0.5 ? <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full">Partial</Badge>
                    : <Badge className="bg-rose-500 text-white border-0 rounded-full"><XCircle className="h-3 w-3 mr-1" /> Missed</Badge>}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Your answer: <b className={r.correct >= 0.5 ? "text-mint" : "text-rose-500"}>{r.given || "—"}</b></p>
              <p className="text-sm">Expected: <b>{r.expected}</b></p>
              <p className="text-sm rounded-lg bg-muted/60 p-2.5"><Brain className="h-3.5 w-3.5 inline mr-1.5 text-lavender" />{r.explanation}</p>
              {r.feedback ? <p className="text-xs text-muted-foreground"><b>Grader feedback:</b> {r.feedback}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
