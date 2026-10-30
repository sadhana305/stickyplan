import { db } from "@/lib/db";
import { withUser } from "@/lib/api-helpers";

export async function GET() {
  return withUser(async (user) => {
    const quizzes = await db.quiz.findMany({
      where: { userId: user.id, completed: true },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, date: true, score: true, total: true, accuracy: true, timeSec: true, createdAt: true },
    });
    return { attempts: quizzes };
  });
}
