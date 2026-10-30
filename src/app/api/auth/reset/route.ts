import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ code?: string; password?: string; confirmPassword?: string }>(req);
    const code = (body.code ?? "").trim().toUpperCase();
    const password = body.password ?? "";
    if (!code) return json({ error: "Please enter your reset code." }, 400);
    if (password.length < 8) return json({ error: "New password must be at least 8 characters." }, 400);
    if (body.confirmPassword !== undefined && body.confirmPassword !== password)
      return json({ error: "Passwords do not match." }, 400);

    const reset = await db.passwordReset.findUnique({ where: { token: code } });
    if (!reset || reset.used || reset.expiresAt < new Date())
      return json({ error: "This reset code is invalid or has expired. Please request a new one." }, 400);

    await db.$transaction([
      db.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(password) } }),
      db.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
      db.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
    return json({ ok: true, message: "Password updated. You can now sign in with your new password." });
  } catch {
    return json({ error: "Could not reset your password. Please try again." }, 500);
  }
}
