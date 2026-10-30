import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";
import { chatJson, chat } from "@/lib/ai";

type MaterialContent = {
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

const MATERIAL_SCHEMA = `You are an expert study-material writer. Respond with ONLY valid JSON (no markdown fences, no commentary) shaped exactly like:
{"simple":"a friendly simple explanation in plain language (markdown allowed)","detailed":"a thorough explanation (markdown allowed)","definitions":[{"term":"...","meaning":"..."}],"keyPoints":["..."],"examples":[{"title":"...","description":"..."}],"formulas":[{"name":"...","expression":"...","derivation":"..."}],"tables":[{"title":"...","headers":["..."],"rows":[["..."]]}],"summary":"a quick revision summary","flashcards":[{"front":"question","back":"answer"}]}
Rules:
- If formulas or tables are not relevant for this topic, use null for that field.
- 4-8 key points, 2-5 examples, 3-8 flashcards.
- Keep the detailed explanation complete but focused (max ~600 words).`;

export async function POST(req: Request) {
  const body = await parseBody<{
    topicId?: string;
    action?: "generate" | "simplify" | "followup";
    question?: string;
  }>(req);
  return withUser(async (user) => {
    if (!body.topicId) throw new Error("Missing topic.");
    const topic = await db.topic.findFirst({
      where: { id: body.topicId, userId: user.id },
      include: { subject: { select: { name: true } }, chapter: { select: { name: true } } },
    });
    if (!topic) throw new Error("Topic not found.");

    const context = `Topic: "${topic.name}" | Chapter: "${topic.chapter.name}" | Subject: "${topic.subject.name}" | Education level: ${user.educationLevel ?? "student"} | Learning preferences: ${user.learningPrefs ?? "not specified"}`;

    if (body.action === "simplify") {
      const material = await db.studyMaterial.findFirst({
        where: { userId: user.id, topicId: topic.id },
        orderBy: { createdAt: "desc" },
      });
      const prev = material ? (JSON.parse(material.content) as MaterialContent) : null;
      const simple = await chat(
        [
          { role: "assistant", content: "You are a patient tutor who explains things as simply as possible, using everyday analogies." },
          { role: "user", content: `Explain this topic much more simply, like I'm 12, with an everyday analogy. Use markdown.\n\n${context}${prev ? `\n\nPrevious explanation for reference:\n${prev.simple}` : ""}` },
        ],
        "simplify"
      );
      return { simplify: simple };
    }

    if (body.action === "followup") {
      const question = (body.question ?? "").trim();
      if (!question) throw new Error("Type a question first.");
      const material = await db.studyMaterial.findFirst({
        where: { userId: user.id, topicId: topic.id },
        orderBy: { createdAt: "desc" },
      });
      if (!material) throw new Error("Generate the study material first, then ask follow-ups.");
      const answer = await chat(
        [
          {
            role: "assistant",
            content:
              "You are a helpful study tutor. Answer the student's follow-up question strictly using the study material below as your main source (you may add general knowledge if needed). Be concise, clear and encouraging. Use markdown.",
          },
          { role: "user", content: `Study material:\n${material.content.slice(0, 8000)}\n\nStudent's question: ${question}` },
        ],
        "followup"
      );
      return { answer };
    }

    // Full generation
    const content = await chatJson<MaterialContent>(
      MATERIAL_SCHEMA,
      `Write complete study material for this topic.\n\n${context}`
    );
    const material = await db.studyMaterial.create({
      data: { userId: user.id, topicId: topic.id, topicTitle: topic.name, content: JSON.stringify(content) },
    });
    return { materialId: material.id, content };
  });
}

export async function GET(req: Request) {
  const topicId = new URL(req.url).searchParams.get("topicId");
  return withUser(async (user) => {
    if (topicId) {
      const material = await db.studyMaterial.findFirst({
        where: { userId: user.id, topicId },
        orderBy: { createdAt: "desc" },
      });
      return { material: material ? { ...material, content: JSON.parse(material.content) } : null };
    }
    const materials = await db.studyMaterial.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, topicId: true, topicTitle: true, createdAt: true },
    });
    return { materials };
  });
}
