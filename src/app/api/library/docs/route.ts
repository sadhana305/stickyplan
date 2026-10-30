import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";
import { saveDocFile, deleteDocFile, extFromName } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES = 10;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
]);

function kindFor(mime: string): "PDF" | "IMAGE" | "TEXT" {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "IMAGE";
  return "TEXT";
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const folderId = sp.get("folderId"); // "all" | "root" | <id>
  const category = sp.get("category");
  const kind = sp.get("kind");
  const bookmarked = sp.get("bookmarked");
  const tag = sp.get("tag");

  return withUser(async (user) => {
    const where: Record<string, unknown> = { userId: user.id };
    if (folderId === "root") where.folderId = null;
    else if (folderId && folderId !== "all") where.folderId = folderId;
    if (category && category !== "all") where.category = category;
    if (kind && kind !== "all") where.kind = kind;
    if (bookmarked === "1") where.bookmarked = true;
    if (q) {
      (where as { OR?: unknown }).OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
        { subjectName: { contains: q } },
        { chapterName: { contains: q } },
        { topicName: { contains: q } },
        { examName: { contains: q } },
        { extractedText: { contains: q } },
      ];
    }
    if (tag) where.tags = { contains: `"${tag}"` };

    const docs = await db.libraryDoc.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, folderId: true, name: true, kind: true, category: true, description: true,
        tags: true, bookmarked: true, size: true, mime: true, ext: true, textState: true, textNote: true,
        subjectName: true, chapterName: true, topicName: true, examName: true, createdAt: true, updatedAt: true,
        _count: { select: { comments: true } },
      },
    });
    return { docs };
  });
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) throw new Error("Invalid upload.");
  return withUser(async (user) => {
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new Error("Choose at least one file to upload.");
    if (files.length > MAX_FILES) throw new Error(`Please upload up to ${MAX_FILES} files at a time.`);

    const folderId = (form.get("folderId") as string) || null;
    const category = (form.get("category") as string) || "notes";
    const description = ((form.get("description") as string) || "").slice(0, 2000);
    let tags: string[] = [];
    try {
      const parsed = JSON.parse((form.get("tags") as string) || "[]");
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t).trim()).filter(Boolean).slice(0, 12);
    } catch { /* ignore */ }
    const meta = {
      subjectName: ((form.get("subjectName") as string) || "").slice(0, 120),
      chapterName: ((form.get("chapterName") as string) || "").slice(0, 120),
      topicName: ((form.get("topicName") as string) || "").slice(0, 120),
      examName: ((form.get("examName") as string) || "").slice(0, 120),
    };

    if (folderId) {
      const folder = await db.libraryFolder.findFirst({ where: { id: folderId, userId: user.id } });
      if (!folder) throw new Error("That folder no longer exists.");
    }

    const created: { id: string; name: string }[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      const mime = file.type || "";
      const ext = extFromName(file.name);
      const isTextKind = mime === "text/plain" || mime === "text/markdown" || [".txt", ".md"].includes(ext);
      if (!ALLOWED_MIME.has(mime) && !isTextKind) {
        skipped.push(`${file.name} (unsupported type — use PDF, images or .txt/.md notes)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(`${file.name} (larger than 20 MB)`);
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const name = file.name.slice(0, 180);

      // PDFs: read text immediately (fast, non-AI). Image OCR happens on demand via "Read with AI".
      let extractedText = "";
      let textState = "PENDING";
      let textNote = "";
      if (kindFor(mime) === "PDF") {
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const result = await extractPdfText(buffer);
          extractedText = result.text;
          if (extractedText.length >= 20) {
            textState = "READY";
            textNote = `${Math.ceil(extractedText.length / 1000)}k characters read from the PDF`;
          } else {
            textState = "EMPTY";
            textNote = "No selectable text found — this PDF looks like a scanned copy. Try “Read with AI”, or upload photos of the pages instead.";
          }
        } catch {
          textState = "FAILED";
          textNote = "Could not read this PDF automatically. You can still preview it, or upload page photos for AI reading.";
        }
      } else if (kindFor(mime) === "TEXT") {
        extractedText = buffer.toString("utf8").replace(/\u0000/g, "").trim();
        textState = extractedText.length >= 1 ? "READY" : "EMPTY";
        textNote = extractedText ? "Typed note — fully readable by AI" : "This file is empty.";
      } else {
        textNote = "AI can read this image with OCR — open it and press “Read with AI”.";
      }

      const doc = await db.libraryDoc.create({
        data: {
          userId: user.id,
          folderId: folderId ?? null,
          name,
          kind: mime === "application/pdf" ? "PDF" : mime.startsWith("image/") ? "IMAGE" : "TEXT",
          category,
          description,
          tags: JSON.stringify(tags),
          size: file.size,
          mime: mime || (isTextKind ? "text/plain" : "application/octet-stream"),
          ext,
          extractedText: extractedText.slice(0, 200_000),
          textState,
          textNote,
          ...meta,
        },
      });
      await saveDocFile(user.id, doc.id, ext, buffer);
      created.push({ id: doc.id, name: doc.name });
    }

    return {
      created,
      skipped,
      message:
        created.length === 0
          ? "No files were uploaded."
          : `Uploaded ${created.length} file${created.length > 1 ? "s" : ""}.`,
    };
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  return withUser(async (user) => {
    const id = String(body.id ?? "");
    if (!id) throw new Error("Missing document id.");
    const doc = await db.libraryDoc.findFirst({ where: { id, userId: user.id } });
    if (!doc) throw new Error("Document not found.");

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 180);
    if (typeof body.description === "string") data.description = body.description.slice(0, 2000);
    if (Array.isArray(body.tags)) data.tags = JSON.stringify(body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12));
    if (typeof body.bookmarked === "boolean") data.bookmarked = body.bookmarked;
    if (typeof body.category === "string") data.category = body.category;
    if ("folderId" in body) {
      const folderId = body.folderId ? String(body.folderId) : null;
      if (folderId) {
        const folder = await db.libraryFolder.findFirst({ where: { id: folderId, userId: user.id } });
        if (!folder) throw new Error("That folder no longer exists.");
      }
      data.folderId = folderId;
    }
    for (const k of ["subjectName", "chapterName", "topicName", "examName"] as const) {
      if (typeof body[k] === "string") data[k] = (body[k] as string).slice(0, 120);
    }

    const updated = await db.libraryDoc.update({ where: { id: doc.id }, data });
    const { extractedText: _et, ...safe } = updated;
    void _et;
    return { doc: safe };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    const doc = await db.libraryDoc.findFirst({ where: { id, userId: user.id } });
    if (!doc) throw new Error("Document not found.");
    await deleteDocFile(user.id, doc.id, doc.ext);
    await db.libraryDoc.delete({ where: { id: doc.id } });
    return { ok: true };
  });
}
