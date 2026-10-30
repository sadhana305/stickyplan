import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import type { User } from "@prisma/client";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "You need to sign in to continue." }, { status: 401 });
}

export async function withUser<T>(
  handler: (user: User) => Promise<T>
): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const result = await handler(user);
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    console.error("[API error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function parseBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}
