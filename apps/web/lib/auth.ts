import { cookies } from "next/headers";
import {
  buildSessionCookie,
  createUser,
  getSessionUser,
  readSessionCookie,
  SESSION_COOKIE,
  signIn,
} from "@motionforge/database";
import { prisma } from "@motionforge/database";

/**
 * Auth helpers for the Next.js app.
 *
 * For a frictionless first-run experience, `requireUser` will create a
 * local workspace user and session automatically when no session exists.
 * Real credential sign-in is supported via the auth API routes.
 */

export async function getCurrentUser() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  const token = readSessionCookie(raw);
  return getSessionUser(token);
}

/**
 * Resolve the current user, creating a local workspace user if needed.
 * This keeps the MVP usable without an auth flow while preserving
 * user-scoped authorization.
 */
export async function requireUser() {
  const existing = await getCurrentUser();
  if (existing) return existing;

  // Ensure a default local user exists.
  let user = await prisma.user.findUnique({
    where: { email: "local@motionforge.app" },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    user = await createUser({
      email: "local@motionforge.app",
      name: "Local Creator",
      password: "motionforge-local-dev",
    });
  }

  const session = await signIn("local@motionforge.app", "motionforge-local-dev");
  if (!session) throw new Error("Failed to create a local session.");

  const store = await cookies();
  store.set(SESSION_COOKIE, buildSessionCookie(session.token), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return session.user;
}
