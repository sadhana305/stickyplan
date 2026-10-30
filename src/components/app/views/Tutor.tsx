"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { MessageCircleHeart, Send, Trash2, Bot, User } from "lucide-react";

type Msg = { id: string; role: string; content: string; createdAt: string };

const QUICK_PROMPTS = [
  "Explain my weakest topic simply",
  "Quiz me with 3 quick questions",
  "How should I prepare for my nearest exam?",
  "Give me a memory trick for formulas",
];

export function TutorView() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<{ messages: Msg[] }>("/api/tutor")
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, busy]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    // optimistic user message
    setMessages((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() }]);
    try {
      const r = await api<{ reply: string }>("/api/tutor", { method: "POST", body: { message } });
      setMessages((m) => [...(m ?? []), { id: `reply-${Date.now()}`, role: "assistant", content: r.reply, createdAt: new Date().toISOString() }]);
    } catch (e) {
      toast({ title: "The tutor couldn't reply", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (!confirm("Clear the whole conversation?")) return;
    try {
      await api("/api/tutor", { method: "POST", body: { clear: true } });
      setMessages([]);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Tutor"
        subtitle="Knows your syllabus, your progress and your weak topics."
        icon={<MessageCircleHeart className="h-5 w-5" />}
        action={
          <Button variant="outline" className="rounded-full" onClick={clearChat}><Trash2 className="h-4 w-4 mr-1.5" /> Clear chat</Button>
        }
      />

      <Card className="rounded-xl flex flex-col" style={{ minHeight: "60vh" }}>
        <CardContent className="flex-1 pt-5 pb-2 overflow-y-auto scroll-soft max-h-[62vh] space-y-4">
          {messages === null ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-mint to-lavender mx-auto flex items-center justify-center text-white"><Bot className="h-7 w-7" /></div>
              <p className="font-extrabold">Hi! I'm your study tutor 🌿</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ask me anything about your subjects — I'll explain step by step, give examples, help you solve problems, and I know which topics have been tricky for you.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {QUICK_PROMPTS.map((p) => (
                  <button key={p} type="button" onClick={() => send(p)} className="rounded-full border px-3.5 py-1.5 text-xs font-bold hover:border-mint hover:text-mint transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" ? (
                  <span className="h-8 w-8 rounded-full bg-mint-soft text-teal-700 dark:text-teal-200 flex items-center justify-center shrink-0"><Bot className="h-4.5 w-4.5" /></span>
                ) : null}
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed",
                  m.role === "user" ? "bg-mint text-white rounded-br-md" : "bg-muted rounded-bl-md"
                )}>
                  {m.role === "user" ? m.content : <div className="[&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-background/60 [&_code]:rounded [&_code]:px-1 [&_pre]:bg-background/60 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:overflow-x-auto"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
                </div>
                {m.role === "user" ? (
                  <span className="h-8 w-8 rounded-full bg-lavender-soft text-violet-700 dark:text-violet-200 flex items-center justify-center shrink-0"><User className="h-4 w-4" /></span>
                ) : null}
              </div>
            ))
          )}
          {busy ? <div className="flex gap-2.5"><span className="h-8 w-8 rounded-full bg-mint-soft flex items-center justify-center shrink-0"><Bot className="h-4.5 w-4.5 text-teal-700 dark:text-teal-200" /></span><div className="rounded-2xl bg-muted px-4 py-3"><AIRunning label="Your tutor is thinking…" /></div></div> : null}
          <div ref={bottomRef} />
        </CardContent>
        <CardContent className="pt-2 pb-4 border-t">
          <div className="flex gap-2">
            <Textarea
              rows={1}
              placeholder="Ask anything about your subjects…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="flex-1 min-h-11 resize-none"
              aria-label="Message the AI tutor"
            />
            <Button className="rounded-full h-11 w-11 p-0 shrink-0" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send message">
              <Send className="h-4.5 w-4.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
