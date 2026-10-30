import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { withUser, parseBody } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const body = await parseBody<{ currentPassword?: string; newPassword?: string; confirmPassword?: string }>(req);
  return withUser(async (user) => {
    if (!verifyPassword(body.currentPassword ?? "", user.passwordHash))
      throw new Error("Your current password is incorrect.");
    if ((body.newPassword ?? "").length < 8) throw new Error("New password must be at least 8 characters.");
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.newPassword)
      throw new Error("Passwords do not match.");
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(body.newPassword!) },
    });
    return { ok: true, message: "Password changed successfully." };
  });
}
