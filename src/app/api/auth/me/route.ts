import { getSessionUser } from "@/lib/auth";
import { json } from "@/lib/api-helpers";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ user: null });
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingDone: user.onboardingDone,
      themePrefs: user.themePrefs,
    },
  });
}
