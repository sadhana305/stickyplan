import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { readDocFile } from "@/lib/storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Streams a library file to its owner only. Preview uses the browser's built-in
 * PDF/image viewer; ?download=1 forces a download with the original filename.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "You need to sign in to continue." }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const download = sp.get("download") === "1";
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const doc = await db.libraryDoc.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const buffer = await readDocFile(user.id, doc.id, doc.ext);
  if (!buffer) return NextResponse.json({ error: "The stored file is missing. Please re-upload it." }, { status: 410 });

  const asciiName = doc.name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const disposition = `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=60",
    },
  });
}
