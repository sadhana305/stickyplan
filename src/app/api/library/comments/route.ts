import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function GET(req: Request) {
  const docId = new URL(req.url).searchParams.get("docId");
  return withUser(async (user) => {
    if (!docId) throw new Error("Missing docId.");
    const comments = await db.libraryComment.findMany({
      where: { docId, userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return { comments };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ docId?: string; page?: number; quote?: string; note?: string; color?: string }>(req);
  return withUser(async (user) => {
    const docId = String(body.docId ?? "");
    if (!docId) throw new Error("Missing document.");
    const doc = await db.libraryDoc.findFirst({ where: { id: docId, userId: user.id } });
    if (!doc) throw new Error("Document not found.");
    const note = (body.note ?? "").trim();
    const quote = (body.quote ?? "").trim();
    if (!note && !quote) throw new Error("Write a comment or select some text to highlight first.");
    const color = ["mint", "lemon", "peach", "sky", "lavender"].includes(body.color ?? "") ? body.color! : "mint";
    const comment = await db.libraryComment.create({
      data: {
        docId: doc.id,
        userId: user.id,
        page: typeof body.page === "number" && body.page > 0 ? Math.min(9999, Math.round(body.page)) : null,
        quote: quote.slice(0, 1000),
        note: note.slice(0, 2000),
        color,
      },
    });
    return { comment };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    await db.libraryComment.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });
}
