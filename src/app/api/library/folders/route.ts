import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (user) => {
    const folders = await db.libraryFolder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { docs: true, children: true } } },
    });
    return { folders };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ name?: string; parentId?: string | null }>(req);
  return withUser(async (user) => {
    const name = (body.name ?? "").trim();
    if (!name) throw new Error("Give the folder a name.");
    if (name.length > 80) throw new Error("Folder names stay under 80 characters, please.");
    let parentId: string | null = null;
    if (body.parentId) {
      const parent = await db.libraryFolder.findFirst({ where: { id: body.parentId, userId: user.id } });
      if (!parent) throw new Error("Parent folder not found.");
      // keep the tree 3 levels deep so it stays tidy
      if (parent.parentId) {
        const grand = await db.libraryFolder.findFirst({ where: { id: parent.parentId, userId: user.id } });
        if (grand?.parentId) throw new Error("Folders nest up to 3 levels — pick a shallower spot.");
      }
      parentId = parent.id;
    }
    const folder = await db.libraryFolder.create({ data: { userId: user.id, name, parentId } });
    return { folder };
  });
}

export async function PATCH(req: Request) {
  const body = await parseBody<{ id?: string; name?: string; parentId?: string | null }>(req);
  return withUser(async (user) => {
    if (!body.id) throw new Error("Missing folder id.");
    const folder = await db.libraryFolder.findFirst({ where: { id: body.id, userId: user.id } });
    if (!folder) throw new Error("Folder not found.");
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
    if ("parentId" in body) {
      const parentId = body.parentId ? String(body.parentId) : null;
      if (parentId) {
        if (parentId === folder.id) throw new Error("A folder cannot be inside itself.");
        const parent = await db.libraryFolder.findFirst({ where: { id: parentId, userId: user.id } });
        if (!parent) throw new Error("Parent folder not found.");
        // prevent cycles: walk up the chain
        let cursor: string | null = parent.parentId;
        let depth = 0;
        while (cursor && depth < 5) {
          if (cursor === folder.id) throw new Error("That move would create a loop.");
          const next = await db.libraryFolder.findFirst({ where: { id: cursor, userId: user.id } });
          cursor = next?.parentId ?? null;
          depth++;
        }
      }
      data.parentId = parentId;
    }
    const updated = await db.libraryFolder.update({ where: { id: folder.id }, data });
    return { folder: updated };
  });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return withUser(async (user) => {
    if (!id) throw new Error("Missing id.");
    const folder = await db.libraryFolder.findFirst({ where: { id, userId: user.id } });
    if (!folder) throw new Error("Folder not found.");
    await db.libraryFolder.delete({ where: { id: folder.id } }); // subfolders cascade; docs detach (SetNull)
    return { ok: true };
  });
}
