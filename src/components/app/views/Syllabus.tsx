"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, readFileAsBase64, subjectColor, DIFFICULTY_STYLES } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ErrorState, AIRunning } from "@/components/app/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FolderTree,
  Upload,
  ImageIcon,
  ClipboardPaste,
  CheckCheck,
  Trash2,
  Plus,
  Pencil,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";

type Topic = {
  id: string;
  name: string;
  difficulty: string;
  status: string;
  estMinutes: number;
  importance: number;
  subtopics: string;
};
type Chapter = { id: string; name: string; order: number; topics: Topic[] };
type Subject = { id: string; name: string; semester: string | null; color: string; chapters: Chapter[] };

type DraftTopic = { name: string; subtopics: string[] };
type DraftChapter = { name: string; topics: DraftTopic[] };
type DraftSubject = { name: string; chapters: DraftChapter[] };

export function SyllabusView() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Import state
  const [tab, setTab] = useState("file");
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<DraftSubject[] | null>(null);
  const [replace, setReplace] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  // add forms
  const [newSubjectName, setNewSubjectName] = useState("");
  const [chapterDraft, setChapterDraft] = useState<Record<string, string>>({});
  const [topicDraft, setTopicDraft] = useState<Record<string, { name: string; difficulty: string }>>({});

  const load = useCallback(() => {
    setError(null);
    api<{ subjects: Subject[] }>("/api/subjects")
      .then((r) => setSubjects(r.subjects))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your syllabus."));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function handleFile(file: File, mode: "pdf" | "image") {
    setExtracting(true);
    setDraft(null);
    try {
      const { base64, mime } = await readFileAsBase64(file);
      const r = await api<{ extracted: DraftSubject[]; source: string }>("/api/syllabus/extract", {
        method: "POST",
        body: { mode, base64, mime, fileName: file.name },
      });
      setDraft(r.extracted);
      toast({ title: "Extraction complete 🎉", description: "Review the structure below, edit anything, then save." });
    } catch (e) {
      toast({ title: "Extraction failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  }

  async function extractText() {
    setExtracting(true);
    setDraft(null);
    try {
      const r = await api<{ extracted: DraftSubject[] }>("/api/syllabus/extract", {
        method: "POST",
        body: { mode: "text", text: pastedText },
      });
      setDraft(r.extracted);
      toast({ title: "Extraction complete 🎉", description: "Review, edit, then save to your account." });
    } catch (e) {
      toast({ title: "Extraction failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  }

  async function importDraft() {
    if (!draft) return;
    setImporting(true);
    try {
      const r = await api<{ subjectsCreated: number; chaptersCreated: number; topicsCreated: number }>("/api/syllabus/import", {
        method: "POST",
        body: { subjects: draft, replace },
      });
      toast({
        title: "Syllabus saved 🌿",
        description: `${r.subjectsCreated} subjects, ${r.chaptersCreated} chapters, ${r.topicsCreated} topics added.`,
      });
      setDraft(null);
      setPastedText("");
      load();
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    try {
      await api("/api/subjects", { method: "POST", body: { name: newSubjectName } });
      setNewSubjectName("");
      load();
    } catch (e) {
      toast({ title: "Could not add", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addChapter(subjectId: string) {
    const name = (chapterDraft[subjectId] ?? "").trim();
    if (!name) return;
    try {
      await api("/api/chapters", { method: "POST", body: { subjectId, name } });
      setChapterDraft((d) => ({ ...d, [subjectId]: "" }));
      load();
    } catch (e) {
      toast({ title: "Could not add chapter", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function addTopic(chapterId: string) {
    const d = topicDraft[chapterId] ?? { name: "", difficulty: "MEDIUM" };
    if (!d.name.trim()) return;
    try {
      await api("/api/topics", { method: "POST", body: { chapterId, name: d.name, difficulty: d.difficulty } });
      setTopicDraft((t) => ({ ...t, [chapterId]: { name: "", difficulty: "MEDIUM" } }));
      load();
    } catch (e) {
      toast({ title: "Could not add topic", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function patchTopic(t: Topic, data: Record<string, unknown>) {
    try {
      await api("/api/topics", { method: "PATCH", body: { id: t.id, ...data } });
      load();
    } catch (e) {
      toast({ title: "Could not update topic", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function remove(kind: "subjects" | "chapters" | "topics", id: string, label: string) {
    if (!confirm(`Delete ${label}? Its sub-items will also be removed.`)) return;
    try {
      await api(`/api/${kind}?id=${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  const allTopics = (subjects ?? []).flatMap((s) => s.chapters.flatMap((c) => c.topics));
  const doneTopics = allTopics.filter((t) => t.status === "COMPLETED").length;
  const pct = allTopics.length ? Math.round((doneTopics / allTopics.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Syllabus" subtitle="Course → Semester → Subject → Chapter → Topic, with AI import." icon={<FolderTree className="h-5 w-5" />} />

      {/* Progress */}
      <Card className="rounded-xl">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-extrabold">Overall completion</span>
            <span className="text-muted-foreground">{doneTopics}/{allTopics.length} topics · {pct}%</span>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {/* AI import */}
      <Card className="rounded-xl border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-mint" /> Import with AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="rounded-full">
              <TabsTrigger value="file" className="rounded-full"><Upload className="h-3.5 w-3.5 mr-1" /> PDF</TabsTrigger>
              <TabsTrigger value="image" className="rounded-full"><ImageIcon className="h-3.5 w-3.5 mr-1" /> Photo</TabsTrigger>
              <TabsTrigger value="text" className="rounded-full"><ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">Upload a syllabus PDF — AI reads it and extracts subjects, chapters and topics.</p>
              <input ref={fileInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "pdf"); e.target.value = ""; }} />
              <Button variant="outline" className="rounded-full" disabled={extracting} onClick={() => fileInput.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" /> Choose PDF
              </Button>
            </TabsContent>

            <TabsContent value="image" className="mt-3">
              <p className="text-sm text-muted-foreground mb-2">Photograph your syllabus pages — OCR reads the text and AI structures it.</p>
              <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "image"); e.target.value = ""; }} />
              <Button variant="outline" className="rounded-full" disabled={extracting} onClick={() => imageInput.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-1.5" /> Choose photo
              </Button>
            </TabsContent>

            <TabsContent value="text" className="mt-3 space-y-2">
              <Textarea rows={5} placeholder="Paste your syllabus here — e.g. 'Unit 1: Data Structures — arrays, linked lists, stacks…'" value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
              <Button className="rounded-full" disabled={extracting || pastedText.trim().length < 20} onClick={extractText}>
                <Sparkles className="h-4 w-4 mr-1.5" /> Extract structure
              </Button>
            </TabsContent>
          </Tabs>

          {extracting ? <div className="mt-4"><AIRunning label="Reading your syllabus…" /></div> : null}

          {draft ? (
            <div className="mt-4 rounded-xl border bg-muted/40 p-4 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-extrabold text-sm">Review & edit before saving</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  Replace my existing syllabus
                </label>
              </div>
              <div className="max-h-80 overflow-y-auto scroll-soft space-y-3">
                {draft.map((s, si) => (
                  <div key={si} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <Input className="h-8 font-bold text-sm" value={s.name} onChange={(e) => setDraft((d) => d && d.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)))} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove subject" onClick={() => setDraft((d) => d && d.filter((_, i) => i !== si))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-mint/40">
                      {s.chapters.map((c, ci) => (
                        <div key={ci}>
                          <div className="flex items-center gap-2">
                            <Input className="h-7 text-xs font-semibold" value={c.name} onChange={(e) => setDraft((d) => d && d.map((x, i) => (i === si ? { ...x, chapters: x.chapters.map((y, j) => (j === ci ? { ...y, name: e.target.value } : y)) } : x)))} />
                            <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove chapter" onClick={() => setDraft((d) => d && d.map((x, i) => (i === si ? { ...x, chapters: x.chapters.filter((_, j) => j !== ci) } : x)))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground ml-3 mt-0.5">{c.topics.map((t) => t.name).join(" · ") || "no topics"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button className="rounded-full" disabled={importing} onClick={importDraft}>
                <CheckCheck className="h-4 w-4 mr-1.5" /> {importing ? "Saving…" : "Save to my syllabus"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {/* Tree */}
      {!subjects ? (
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      ) : subjects.length === 0 ? (
        <EmptyState icon={<FolderTree className="h-6 w-6" />} title="Your syllabus is empty" description="Use the AI import above, or add a subject manually below." />
      ) : (
        <div className="space-y-4">
          {subjects.map((s) => {
            const c = subjectColor(s.color);
            const topics = s.chapters.flatMap((ch) => ch.topics);
            const done = topics.filter((t) => t.status === "COMPLETED").length;
            const open = expanded[s.id] ?? true;
            return (
              <Card key={s.id} className="rounded-xl">
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setExpanded((e) => ({ ...e, [s.id]: !open }))}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button aria-label={open ? "Collapse" : "Expand"} className="text-muted-foreground">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span className={`h-3 w-3 rounded-full shrink-0 ${c.dot}`} />
                      <div className="min-w-0">
                        <CardTitle className="text-base font-extrabold truncate">{s.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{s.chapters.length} chapters · {done}/{topics.length} topics done</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Delete subject ${s.name}`} onClick={(e) => { e.stopPropagation(); remove("subjects", s.id, `subject "${s.name}"`); }}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                </CardHeader>
                {open ? (
                  <CardContent className="pt-0 space-y-3">
                    {s.chapters.map((ch) => (
                      <div key={ch.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm">{ch.name}</p>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete chapter ${ch.name}`} onClick={() => remove("chapters", ch.id, `chapter "${ch.name}"`)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {ch.topics.map((t) => (
                            <TopicRow key={t.id} topic={t} onPatch={patchTopic} onRemove={() => remove("topics", t.id, `topic "${t.name}"`)} />
                          ))}
                          <div className="flex gap-2 pt-1">
                            <Input className="h-8 text-xs" placeholder="New topic…" value={topicDraft[ch.id]?.name ?? ""} onChange={(e) => setTopicDraft((d) => ({ ...d, [ch.id]: { name: e.target.value, difficulty: d[ch.id]?.difficulty ?? "MEDIUM" } }))} />
                            <Select value={topicDraft[ch.id]?.difficulty ?? "MEDIUM"} onValueChange={(v) => setTopicDraft((d) => ({ ...d, [ch.id]: { name: d[ch.id]?.name ?? "", difficulty: v } }))}>
                              <SelectTrigger className="h-8 w-28 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                              <SelectContent>{["EASY", "MEDIUM", "HARD"].map((d) => <SelectItem key={d} value={d} className="text-xs">{d[0] + d.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" className="h-8 rounded-lg shrink-0" onClick={() => addTopic(ch.id)}><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs" placeholder={`New chapter in ${s.name}…`} value={chapterDraft[s.id] ?? ""} onChange={(e) => setChapterDraft((d) => ({ ...d, [s.id]: e.target.value }))} />
                      <Button size="sm" variant="outline" className="h-8 rounded-lg shrink-0" onClick={() => addChapter(s.id)}><Plus className="h-3.5 w-3.5 mr-0.5" /> Chapter</Button>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            );
          })}

          <div className="flex gap-2 max-w-md">
            <Input placeholder="Add another subject…" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject()} />
            <Button className="rounded-full shrink-0" onClick={addSubject}><Plus className="h-4 w-4 mr-1" /> Subject</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopicRow({
  topic,
  onPatch,
  onRemove,
}: {
  topic: Topic;
  onPatch: (t: Topic, data: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const subtopics = (() => {
    try {
      return JSON.parse(topic.subtopics) as string[];
    } catch {
      return [];
    }
  })();

  if (editing) {
    return (
      <div className="flex gap-1.5">
        <Input className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { onPatch(topic, { name }); setEditing(false); } }} />
        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => { onPatch(topic, { name }); setEditing(false); }}>Save</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <button
        type="button"
        aria-label={topic.status === "COMPLETED" ? `Mark ${topic.name} as pending` : `Mark ${topic.name} as completed`}
        onClick={() => onPatch(topic, { status: topic.status === "COMPLETED" ? "PENDING" : "COMPLETED" })}
        className={cn(
          "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
          topic.status === "COMPLETED" ? "bg-mint border-mint text-white" : "hover:border-mint"
        )}
      >
        {topic.status === "COMPLETED" ? <CheckCheck className="h-3.5 w-3.5" /> : null}
      </button>
      <span className={cn("text-xs flex-1 min-w-0 truncate", topic.status === "COMPLETED" && "line-through opacity-50")}>
        {topic.name}
        {subtopics.length > 0 ? <span className="text-muted-foreground"> · {subtopics.length} subtopics</span> : null}
      </span>
      <Select value={topic.difficulty} onValueChange={(v) => onPatch(topic, { difficulty: v })}>
        <SelectTrigger className="h-6 w-24 text-[11px] rounded-md border-0 px-2"><SelectValue /></SelectTrigger>
        <SelectContent>{["EASY", "MEDIUM", "HARD"].map((d) => <SelectItem key={d} value={d} className="text-xs">{d[0] + d.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
      </Select>
      <Badge className={cn("text-[9px] px-1.5 border-0 rounded-full", DIFFICULTY_STYLES[topic.difficulty])}>{topic.estMinutes}m</Badge>
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Edit ${topic.name}`} onClick={() => setEditing(true)}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${topic.name}`} onClick={onRemove}>
        <Trash2 className="h-3 w-3 text-rose-500" />
      </Button>
    </div>
  );
}
