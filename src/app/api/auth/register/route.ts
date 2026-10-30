import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { json, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  try {
    const body = await parseBody<{ name?: string; email?: string; password?: string; confirmPassword?: string }>(req);
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!name || name.length > 80) return json({ error: "Please enter your name." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    if (body.confirmPassword !== undefined && body.confirmPassword !== password)
      return json({ error: "Passwords do not match." }, 400);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return json({ error: "An account with this email already exists. Try logging in." }, 409);

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
      select: { id: true, name: true, email: true, onboardingDone: true },
    });
    await createSession(user.id);
    await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Welcome to STICKY PLAN! 🌿",
        body: "Complete onboarding so we can build your personalised study plan.",
      },
    });
    return json({ user });
  } catch {
    return json({ error: "Could not create your account. Please try again." }, 500);
  }
}
