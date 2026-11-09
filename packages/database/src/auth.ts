import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./client.js";

/**
 * Authentication.
 *
 * A small, self-contained credential system: scrypt password hashing and
 * opaque session tokens stored in the database. It avoids a hard dependency
 * on a third-party auth vendor while still meeting the security
 * requirements (no plaintext passwords, constant-time comparisons,
 * revocable sessions).
 */

const SESSION_COOKIE = "motionforge_session";
const SESSION_TTL_DAYS = 30;

/** Hash a password with scrypt and a random salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/** Verify a password against a stored hash, in constant time. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  if (derived.length !== expectedBuffer.length) return false;
  return timingSafeEqual(derived, expectedBuffer);
}

/** Create a session token. */
function createToken(): string {
  return randomBytes(32).toString("hex");
}

/** Sign a value with the auth secret. */
function sign(value: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Build the signed cookie value for a session token. */
export function buildSessionCookie(token: string): string {
  return `${token}.${sign(token)}`;
}

/** Extract and verify the session token from a cookie value. */
export function readSessionCookie(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const separator = cookie.lastIndexOf(".");
  if (separator <= 0) return null;

  const token = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  const expected = sign(token);

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return token;
}

/** Register a user. */
export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string; email: string; name: string }> {
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash: hashPassword(input.password),
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}

/** Verify credentials and create a session. */
export async function signIn(
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string; name: string } } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const token = createToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

/** Resolve a session token to a user. */
export async function getSessionUser(
  token: string | null,
): Promise<{ id: string; email: string; name: string } | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/** Revoke a session. */
export async function signOut(token: string | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

/** Remove expired sessions. */
export async function pruneSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export { SESSION_COOKIE };
