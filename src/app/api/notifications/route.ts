import { db } from "@/lib/db";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (user) => {
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { notifications, unread: notifications.filter((n) => !n.read).length };
  });
}

export async function POST(req: Request) {
  const body = await parseBody<{ action?: "read" | "readAll"; id?: string }>(req);
  return withUser(async (user) => {
    if (body.action === "readAll") {
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
      return { ok: true };
    }
    if (body.id && body.action === "read") {
      await db.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
      return { ok: true };
    }
    throw new Error("Unknown action.");
  });
}
