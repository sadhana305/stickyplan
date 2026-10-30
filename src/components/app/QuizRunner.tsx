"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Timer, CheckCircle2, XCircle, Brain, Sparkles } from "lucide-react";

export type RunnerQ = {
  id: string;
  type: string;
  topicName: string;
  question: string;
  options?: string[];
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

const TYPE_LABEL: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True or false",
  FILL_BLANK: "Fill in the blank",
  SHORT: "Short answer",
};

/**
 * Interactive quiz player for quizzes created from a student's own materials
 * or question bank. Submits through the same engine as the Daily Quiz, so
 * scores, streaks and analytics keep working.
 */
export function QuizRunner({
  quizId,
  questions,
  title,
  onDone,
}: {
  quizId: string;
  questions: RunnerQ[];
  title: string;
  onDone?: (accuracy: number) => void;
}) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; total: number; accuracy: number; results: Result[] } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [answers, questions]
  );

  async function submit() {
    const missing = questions.filter((q) => !(answers[q.id] ?? "").trim());
    if (missing.length > 0 && !confirm(`${missing.length} question(s) are unanswered. Submit anyway?`)) return;
    setSubmitting(true);
    try {
      const r = await api<{ score: number; total: number; accuracy: number; results: Result[] }>("/api/quiz/submit", {
        method: "POST",
        body: { quizId, answers, timeSec: elapsed },
      });
      setResults(r);
      onDone?.(r.accuracy);
      toast({ title: `Scored ${Math.round(r.score)}/${r.total} (${r.accuracy}%)`, description: "Saved to your quiz history." });
    } catch (e) {
      toast({ title: "Submit failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (results) {
    return (
      <div className="space-y-3 animate-fade-up">
        <Card className="rounded-xl text-center border-mint/40 bg-gradient-to-br from-mint-soft/50 to-transparent">
          <CardContent className="py-6">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Your score</p>
            <p className="text-4xl font-extrabold mt-1 brand-gradient">
              {Math.round(results.score * 10) / 10}
              <span className="text-xl text-foreground">/{results.total}</span>
            </p>
            <p className="mt-1 font-bold">{results.accuracy}% accuracy</p>
            <p className="text-sm text-muted-foreground mt-1">
              {results.accuracy >= 80 ? "Excellent! 🌟" : results.accuracy >= 50 ? "Good effort — review the explanations below." : "Keep going — the explanations below will help."}
            </p>
          </CardContent>
        </Card>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto scroll-soft pr-1">
          {results.results.map((r, i) => (
            <Card key={r.id} className={cn("rounded-xl border", r.correct >= 0.99 ? "border-mint/40" : r.correct >= 0.5 ? "border-lemon/50" : "border-rose-300 dark:border-rose-800")}>
              <CardContent className="pt-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm flex-1">{i + 1}. {r.topicName}</p>
                  {r.correct >= 0.99 ? (
                    <Badge className="bg-mint text-white border-0 rounded-full shrink-0"><CheckCircle2 className="h-3 w-3 mr-1" /> Correct</Badge>
                  ) : r.correct >= 0.5 ? (
                    <Badge className="bg-lemon-soft text-yellow-900 dark:text-yellow-100 border-0 rounded-full shrink-0">Partial</Badge>
                  ) : (
                    <Badge className="bg-rose-500 text-white border-0 rounded-full shrink-0"><XCircle className="h-3 w-3 mr-1" /> Missed</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Your answer: <b className={r.correct >= 0.5 ? "text-mint" : "text-rose-500"}>{r.given || "—"}</b></p>
                <p className="text-sm">Expected: <b>{r.expected}</b></p>
                <p className="text-sm rounded-lg bg-muted/60 p-2"><Brain className="h-3.5 w-3.5 inline mr-1.5 text-lavender" />{r.explanation}</p>
                {r.feedback ? <p className="text-xs text-muted-foreground"><b>Grader feedback:</b> {r.feedback}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold truncate">{title}</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full font-mono"><Timer className="h-3 w-3 mr-1" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</Badge>
          <Badge variant="outline" className="rounded-full"><Sparkles className="h-3 w-3 mr-1" />{answeredCount}/{questions.length}</Badge>
        </div>
      </div>
      <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} />
      <div className="space-y-3 max-h-[55vh] overflow-y-auto scroll-soft pr-1">
        {questions.map((q, i) => {
          const value = answers[q.id] ?? "";
          const set = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));
          return (
            <Card key={q.id} className="rounded-xl">
              <CardContent className="pt-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABEL[q.type] ?? q.type}</Badge>
                </div>
                <p className="text-sm font-bold leading-relaxed">{i + 1}. {q.question}</p>
                {q.type === "MCQ" || q.type === "TRUE_FALSE" ? (
                  <RadioGroup value={value} onValueChange={set} className="grid sm:grid-cols-2 gap-2">
                    {(q.type === "TRUE_FALSE" ? ["True", "False"] : q.options ?? []).map((opt) => (
                      <label key={opt} className={cn("flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm font-semibold transition-colors", value === opt ? "border-mint bg-mint-soft/60" : "hover:border-mint/50")}>
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                ) : q.type === "FILL_BLANK" ? (
                  <Input placeholder="Type your answer…" value={value} onChange={(e) => set(e.target.value)} className="max-w-sm" />
                ) : (
                  <Textarea rows={3} placeholder="Write your answer — graded against the source material…" value={value} onChange={(e) => set(e.target.value)} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button className="rounded-full px-8" onClick={submit} disabled={submitting}>{submitting ? "Grading…" : "Submit quiz"}</Button>
      </div>
    </div>
  );
}
