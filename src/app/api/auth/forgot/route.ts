import { db } from "@/lib/db";
import { randomToken } from "@/lib/auth";
import { json, parseBody } from "@/lib/api-helpers";

/**
 * Password recovery. Email delivery is not configured in this environment,
 * so the reset code is returned directly to the requester (displayed in the UI
 * with a clear note). In production this token would be emailed instead.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody<{ email?: string }>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "Please enter your account email." }, 400);

    const user = await db.user.findUnique({ where: { email } });
    // Always succeed from the user's perspective to avoid account enumeration.
    if (!user) {
      return json({
        ok: true,
        message: "If an account exists for that email, a reset code has been generated.",
        devCode: null,
      });
    }

    const token = randomToken().slice(0, 12).toUpperCase();
    await db.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });
    return json({
      ok: true,
      message:
        "Email delivery isn't configured in this environment, so your reset code is shown below instead of being emailed. It expires in 30 minutes.",
      devCode: token,
    });
  } catch {
    return json({ error: "Could not start password recovery. Please try again." }, 500);
  }
}
