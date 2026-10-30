"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadTextFile } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  NotebookPen,
  Sparkles,
  BookOpen,
  Save,
  Download,
  Bookmark,
  MessageCircle,
  Baby,
  Layers,
  Trash2,
  Lightbulb,
} from "lucide-react";

type Subject = { id: string; name: string; chapters: { id: string; name: string; topics: { id: string; name: string }[] }[] };
type Material = {
  simple: string;
  detailed: string;
  definitions: { term: string; meaning: string }[];
  keyPoints: string[];
  examples: { title: string; description: string }[];
  formulas: { name: string; expression: string; derivation?: string }[] | null;
  tables: { title: string; headers: string[]; rows: string[][] }[] | null;
  summary: string;
  flashcards: { front: string; back: string }[];
};
type Note = { id: string; title: string; content: string; topicTitle: string | null; bookmarked: boolean; updatedAt: string };

export function MaterialsView() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [material, setMaterial] = useState<Material | null>(null);
  const [materialTopic, setMaterialTopic] = useState<{ id: string; name: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [simplified, setSimplified] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [followups, setFollowups] = useState<{ q: string; a: string }[]>([]);
  const [followBusy, setFollowBusy] = useState(false);

  const [saveOpen, setSaveOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  const load = useCallback(() => {
    setError(null);
    Promise.all([api<{ subjects: Subject[] }>("/api/subjects"), api<{ notes: Note[] }>("/api/notes")])
      .then(([s, n]) => {
        setSubjects(s.subjects);
        setNotes(n.notes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load materials."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const chapters = useMemo(() => subjects?.find((s) => s.id === subjectId)?.chapters ?? [], [subjects, subjectId]);
  const topics = useMemo(() => chapters.find((c) => c.id === chapterId)?.topics ?? [], [chapters, chapterId]);

  // Resets UI + fetches any previously generated material for the chosen topic
  function selectTopic(id: string) {
    setTopicId(id);
    setMaterial(null);
    setSimplified(null);
    setFollowups([]);
    setFlipped({});
    const t = topics.find((x) => x.id === id);
    setMaterialTopic(t ? { id: t.id, name: t.name } : null);
    if (!id) return;
    api<{ material: { content: Material } | null }>(`/api/materials?topicId=${id}`)
      .then((r) => {
        if (r.material) setMaterial(r.material.content);
      })
      .catch(() => undefined);
  }

  async function generate() {
    if (!topicId) return;
    setGenerating(true);
    try {
      const r = await api<{ content: Material }>("/api/materials", { method: "POST", body: { topicId, action: "generate" } });
      setMaterial(r.content);
      setSimplified(null);
      setFollowups([]);
      toast({ title: "Study material ready 📖" });
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function simplify() {
    if (!topicId) return;
    setSimplifying(true);
    try {
      const r = await api<{ simplify: string }>("/api/materials", { method: "POST", body: { topicId, action: "simplify" } });
      setSimplified(r.simplify);
    } catch (e) {
      toast({ title: "Could not simplify", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSimplifying(false);
    }
  }

  async function askFollowup() {
    if (!topicId || !question.trim()) return;
    setFollowBusy(true);
    try {
      const r = await api<{ answer: string }>("/api/materials", { method: "POST", body: { topicId, action: "followup", question } });
      setFollowups((f) => [...f, { q: question, a: r.answer }]);
      setQuestion("");
    } catch (e) {
      toast({ title: "Follow-up failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setFollowBusy(false);
    }
  }

  function openSave() {
    if (!material || !materialTopic) return;
    setNoteTitle(`${materialTopic.name} — notes`);
    setNoteContent(buildNoteText(material));
    setSaveOpen(true);
  }

  async function saveNote() {
    try {
      if (editingNote) {
        await api("/api/notes", { method: "PATCH", body: { id: editingNote.id, title: noteTitle, content: noteContent } });
        toast({ title: "Note updated ✏️" });
      } else {
        await api("/api/notes", { method: "POST", body: { title: noteTitle, content: noteContent, topicId, topicTitle: materialTopic?.name } });
        toast({ title: "Note saved to your library 💾" });
      }
      setSaveOpen(false);
      setEditingNote(null);
      load();
    } catch (e) {
      toast({ title: "Could not save note", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function toggleBookmark(note: Note) {
    try {
      await api("/api/notes", { method: "PATCH", body: { id: note.id, bookmarked: !note.bookmarked } });
      load();
    } catch {
      /* ignore */
    }
  }

  async function deleteNote(note: Note) {
    if (!confirm(`Delete note "${note.title}"?`)) return;
    try {
      await api(`/api/notes?id=${note.id}`, { method: "DELETE" });
      load();
    } catch {
      /* ignore */
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Study Materials" subtitle="AI explanations, definitions, examples, formulas, flashcards and notes." icon={<NotebookPen className="h-5 w-5" />} />

      {/* Topic picker */}
      <Card className="rounded-xl">
        <CardContent className="pt-5 grid sm:grid-cols-4 gap-2">
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); setTopicId(""); }}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>{(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId(""); }} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger>
            <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={topicId} onValueChange={selectTopic} disabled={!chapterId}>
            <SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger>
            <SelectContent>{topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="rounded-full" disabled={!topicId || generating} onClick={generate}>
            <Sparkles className="h-4 w-4 mr-1.5" /> {material ? "Regenerate" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      {generating ? (
        <Card className="rounded-xl"><CardContent className="py-12 flex justify-center"><AIRunning label="Writing your study material…" /></CardContent></Card>
      ) : !material ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title={topicId ? "No material yet for this topic" : "Pick a topic to begin"}
          description="Choose subject → chapter → topic, then generate. You'll get simple & detailed explanations, key definitions, examples, formulas, quick summaries and flashcards."
        />
      ) : (
        material && materialTopic ? (
          <div className="space-y-4 animate-fade-up">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold">{materialTopic.name}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={openSave}><Save className="h-4 w-4 mr-1" /> Save as note</Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => downloadTextFile(`${materialTopic.name} — notes.md`, buildNoteText(material), "text/markdown")}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={simplify} disabled={simplifying}>
                  <Baby className="h-4 w-4 mr-1" /> Explain simpler
                </Button>
              </div>
            </div>

            {simplified ? (
              <Card className="rounded-xl border-lavender/50 bg-lavender-soft/30 dark:bg-lavender-soft/10">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold flex items-center gap-2"><Baby className="h-4 w-4 text-lavender" /> Simpler explanation</CardTitle></CardHeader>
                <CardContent className="prose-sm"><Markdown>{simplified}</Markdown></CardContent>
              </Card>
            ) : null}

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">🫧 In simple words</CardTitle></CardHeader>
                <CardContent><Markdown>{material.simple}</Markdown></CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">🎓 Detailed explanation</CardTitle></CardHeader>
                <CardContent><Markdown>{material.detailed}</Markdown></CardContent>
              </Card>
            </div>

            {material.definitions?.length ? (
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">📌 Important definitions</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-2">
                  {material.definitions.map((d, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-bold text-sm">{d.term}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{d.meaning}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">🔑 Key points</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {material.keyPoints.map((k, i) => (
                      <li key={i} className="text-sm flex gap-2"><span className="text-mint font-extrabold">•</span><span>{k}</span></li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">💡 Examples & applications</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {material.examples.map((ex, i) => (
                    <div key={i} className="rounded-lg bg-muted/50 p-3">
                      <p className="font-bold text-sm">{ex.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{ex.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {material.formulas && material.formulas.length > 0 ? (
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">🧮 Formulas & derivations</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {material.formulas.map((f, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-bold text-sm">{f.name}</p>
                      <p className="font-mono text-sm mt-1 bg-muted/60 rounded px-2 py-1.5 inline-block">{f.expression}</p>
                      {f.derivation ? <p className="text-xs text-muted-foreground mt-1.5">{f.derivation}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {material.tables && material.tables.length > 0 ? (
              <Card className="rounded-xl overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">📊 Useful tables</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {material.tables.map((t, i) => (
                    <div key={i}>
                      <p className="font-bold text-sm mb-1.5">{t.title}</p>
                      <div className="overflow-x-auto scroll-soft rounded-lg border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/60"><tr>{t.headers.map((h, j) => <th key={j} className="text-left px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                          <tbody>{t.rows.map((row, j) => <tr key={j} className="border-t">{row.map((cell, k) => <td key={k} className="px-3 py-2">{cell}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-xl border-mint/40 bg-mint-soft/30 dark:bg-mint-soft/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold">⚡ Quick summary</CardTitle></CardHeader>
              <CardContent><Markdown>{material.summary}</Markdown></CardContent>
            </Card>

            {/* Flashcards */}
            {material.flashcards.length > 0 ? (
              <Card className="rounded-xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold flex items-center gap-2"><Layers className="h-4 w-4 text-lavender" /> Flashcards — tap to flip</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {material.flashcards.map((fc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
                      className="min-h-28 rounded-xl border p-4 text-left bg-card hover:shadow-md transition-shadow"
                      aria-pressed={flipped[i]}
                    >
                      {flipped[i] ? (
                        <p className="text-sm">{fc.back}</p>
                      ) : (
                        <p className="text-sm font-bold">{fc.front}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-3 uppercase tracking-wide">{flipped[i] ? "Answer · tap to flip back" : "Question · tap to reveal"}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* Follow-up Q&A */}
            <Card className="rounded-xl">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-extrabold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-sky" /> Ask follow-up questions</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {followups.map((f, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1.5">
                    <p className="text-sm font-bold">Q: {f.q}</p>
                    <div className="text-sm"><Markdown>{f.a}</Markdown></div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input placeholder="e.g. Can you give another example?" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askFollowup()} />
                  <Button className="rounded-full shrink-0" disabled={followBusy || !question.trim()} onClick={askFollowup}>Ask</Button>
                </div>
                {followBusy ? <AIRunning label="Thinking of a good answer…" /> : null}
              </CardContent>
            </Card>
          </div>
        ) : null
      )}

      {/* Notes library */}
      <Card className="rounded-xl">
        <CardHeader className="pb-2"><CardTitle className="text-base font-extrabold">My saved notes ({notes.length})</CardTitle></CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Generate material above and press “Save as note”. Notes stay in your account forever.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{n.title}</p>
                      {n.topicTitle ? <Badge variant="outline" className="rounded-full text-[10px] mt-1">{n.topicTitle}</Badge> : null}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={n.bookmarked ? "Remove bookmark" : "Bookmark note"} onClick={() => toggleBookmark(n)}>
                        <Bookmark className={`h-3.5 w-3.5 ${n.bookmarked ? "fill-peach text-peach" : ""}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit note" onClick={() => { setEditingNote(n); setNoteTitle(n.title); setNoteContent(n.content); setSaveOpen(true); }}>
                        <Lightbulb className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download note" onClick={() => downloadTextFile(`${n.title}.md`, n.content, "text/markdown")}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete note" onClick={() => deleteNote(n)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{n.content.slice(0, 160)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save note dialog */}
      <Dialog open={saveOpen} onOpenChange={(o) => { setSaveOpen(o); if (!o) setEditingNote(null); }}>
        <DialogContent className="rounded-xl max-w-2xl">
          <DialogHeader><DialogTitle>{editingNote ? "Edit note" : "Save as note"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            <Textarea rows={10} className="font-mono text-xs" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
          </div>
          <DialogFooter><Button className="rounded-full" onClick={saveNote} disabled={!noteTitle.trim() || !noteContent.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildNoteText(m: Material): string {
  const parts = [
    "## In simple words",
    m.simple,
    "## Detailed explanation",
    m.detailed,
    "## Definitions",
    ...m.definitions.map((d) => `- **${d.term}** — ${d.meaning}`),
    "## Key points",
    ...m.keyPoints.map((k) => `- ${k}`),
    "## Examples",
    ...m.examples.map((e) => `- **${e.title}**: ${e.description}`),
  ];
  if (m.formulas?.length) {
    parts.push("## Formulas", ...m.formulas.map((f) => `- ${f.name}: ${f.expression}${f.derivation ? `\n  Derivation: ${f.derivation}` : ""}`));
  }
  if (m.tables?.length) {
    for (const t of m.tables) {
      parts.push(`## ${t.title}`, `| ${t.headers.join(" | ")} |`, `| ${t.headers.map(() => "---").join(" | ")} |`, ...t.rows.map((r) => `| ${r.join(" | ")} |`));
    }
  }
  parts.push("## Summary", m.summary, "## Flashcards", ...m.flashcards.map((f) => `- Q: ${f.front}\n  A: ${f.back}`));
  return parts.join("\n\n");
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:text-xs [&_h1]:hidden">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
