import { and, eq, gt } from 'drizzle-orm';
import type { Context } from 'hono';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';
import { generateSecureToken, hashSecret } from '../utils/crypto.js';

/** Secure flag follows the actual request scheme, not NODE_ENV. */
export function cookieSecureAttr(c: Context): string {
  const forwarded = c.req.header('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0]?.trim().toLowerCase() === 'https' ? '; Secure' : '';
  try {
    return new URL(c.req.url).protocol === 'https:' ? '; Secure' : '';
  } catch {
    return '';
  }
}

export async function createSession(userId: string, deviceInfo?: string, ip?: string) {
  const env = getEnv();
  const token = generateSecureToken(32);
  const tokenHash = hashSecret(token);

  const db = getDb();
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: createId(),
    userId,
    tokenHash,
    deviceInfo,
    ip,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function validateSession(token: string) {
  const tokenHash = hashSecret(token);
  const db = getDb();

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
    with: {
      user: true,
    },
  });

  if (!session || !session.user || !session.user.isActive) {
    return null;
  }

  await db.update(sessions).set({ lastActivityAt: new Date() }).where(eq(sessions.id, session.id));

  return session;
}

export async function revokeSession(token: string) {
  const tokenHash = hashSecret(token);
  const db = getDb();

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function revokeAllSessions(userId: string, exceptToken?: string) {
  const db = getDb();

  if (exceptToken) {
    const exceptHash = hashSecret(exceptToken);
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.tokenHash, exceptHash)));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

export async function getUserSessions(userId: string) {
  const db = getDb();
  return db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
    orderBy: (sessions, { desc }) => [desc(sessions.lastActivityAt)],
  });
}

export function extractTokenFromCookie(
  cookieHeader: string | undefined,
  cookieName: string
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === cookieName) {
      return value;
    }
  }
  return null;
}

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}
