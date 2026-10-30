import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { json, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ email?: string; password?: string }>(req);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) return json({ error: "Please enter your email and password." }, 400);

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash))
      return json({ error: "Incorrect email or password." }, 401);

    await createSession(user.id);
    return json({ user: { id: user.id, name: user.name, email: user.email, onboardingDone: user.onboardingDone } });
  } catch {
    return json({ error: "Could not sign you in. Please try again." }, 500);
  }
}
