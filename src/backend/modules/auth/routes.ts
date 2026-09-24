import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { sessions } from '../../db/schema/sessions.js';
import { users } from '../../db/schema/users.js';
import { auditLog } from '../../middleware/audit.js';
import {
  cookieSecureAttr,
  createSession,
  extractTokenFromCookie,
  getUserSessions,
  revokeAllSessions,
  revokeSession,
} from '../../middleware/auth.js';
import { AuthenticationError, NotFoundError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';
import { generateCsrfToken, hashSecret } from './csrf.js';
import { changePassword, hashPassword, verifyPassword } from './password.js';

const auth = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const setupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
    baseUrl: z.string().url().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

auth.get('/setup-status', async (c) => {
  const db = getDb();
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, 'admin'),
  });
  return c.json({ success: true, data: { needsSetup: !existingAdmin } });
});

auth.post('/setup', zValidator('json', setupSchema), async (c) => {
  const db = getDb();
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, 'admin'),
  });

  if (existingAdmin) {
    return c.json(
      {
        success: false,
        error: { code: 'ALREADY_INITIALIZED', message: 'System already initialized' },
      },
      400
    );
  }

  const { email, password } = c.req.valid('json');
  const passwordHash = await hashPassword(password);
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    role: 'admin',
  });

  const { token, expiresAt } = await createSession(
    userId,
    'setup-wizard',
    c.req.header('x-forwarded-for')
  );
  const csrfToken = generateCsrfToken();

  const secure = cookieSecureAttr(c);
  const sessionMaxAge = getEnv().SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
  const sessionCookie = `${getEnv().SESSION_COOKIE_NAME}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${sessionMaxAge}`;
  const csrfCookie = `${getEnv().CSRF_COOKIE_NAME}=${hashSecret(csrfToken)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${sessionMaxAge}`;
  c.header('Set-Cookie', [sessionCookie, csrfCookie]);

  auditLog({
    userId,
    action: 'auth.setup',
    resourceType: 'user',
    resourceId: userId,
    ip: c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: { user: { id: userId, email, role: 'admin' }, expiresAt },
  });
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, rememberMe } = c.req.valid('json');
  const db = getDb();

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.isActive) {
    throw new AuthenticationError('Invalid credentials');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await db
      .update(users)
      .set({
        failedLoginAttempts: { increment: 1 },
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      })
      .where(eq(users.id, user.id));
    throw new AuthenticationError('Invalid credentials');
  }

  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const maxAge = rememberMe ? getEnv().SESSION_MAX_AGE_DAYS * 24 * 60 * 60 : 24 * 60 * 60;
  const { token, expiresAt } = await createSession(
    user.id,
    c.req.header('user-agent'),
    c.req.header('x-forwarded-for')
  );
  const csrfToken = generateCsrfToken();

  const secure = cookieSecureAttr(c);
  const sessionCookie = `${getEnv().SESSION_COOKIE_NAME}=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  const csrfCookie = `${getEnv().CSRF_COOKIE_NAME}=${hashSecret(csrfToken)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  c.header('Set-Cookie', [sessionCookie, csrfCookie]);

  auditLog({
    userId: user.id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user.id,
    ip: c.req.header('x-forwarded-for'),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: { user: { id: user.id, email: user.email, role: user.role }, expiresAt },
  });
});

auth.post('/logout', async (c) => {
  const token = extractTokenFromCookie(c.req.header('cookie'), getEnv().SESSION_COOKIE_NAME);
  const userId = c.get('userId');

  if (token) {
    await revokeSession(token);
  }

  const secure = cookieSecureAttr(c);
  const sessionClear = `${getEnv().SESSION_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  const csrfClear = `${getEnv().CSRF_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  c.header('Set-Cookie', [sessionClear, csrfClear]);

  auditLog({
    userId,
    action: 'auth.logout',
    resourceType: 'user',
    resourceId: userId,
  });

  return c.json({ success: true });
});

auth.post('/logout-all', async (c) => {
  const userId = c.get('userId');
  const token = extractTokenFromCookie(c.req.header('cookie'), getEnv().SESSION_COOKIE_NAME);

  await revokeAllSessions(userId, token);

  const secure = cookieSecureAttr(c);
  const sessionClear = `${getEnv().SESSION_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  const csrfClear = `${getEnv().CSRF_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  c.header('Set-Cookie', [sessionClear, csrfClear]);

  auditLog({
    userId,
    action: 'auth.logout_all',
    resourceType: 'user',
    resourceId: userId,
  });

  return c.json({ success: true });
});

auth.get('/me', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return c.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
      404
    );
  }

  return c.json({
    success: true,
    data: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
  });
});

auth.post('/change-password', zValidator('json', changePasswordSchema), async (c) => {
  const userId = c.get('userId');
  const { currentPassword, newPassword } = c.req.valid('json');

  await changePassword(userId, currentPassword, newPassword);

  const secure = cookieSecureAttr(c);
  const sessionClear = `${getEnv().SESSION_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  const csrfClear = `${getEnv().CSRF_COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
  c.header('Set-Cookie', [sessionClear, csrfClear]);

  auditLog({
    userId,
    action: 'auth.password_change',
    resourceType: 'user',
    resourceId: userId,
  });

  return c.json({ success: true });
});

auth.get('/sessions', async (c) => {
  const userId = c.get('userId');
  const sessions = await getUserSessions(userId);
  const currentToken = extractTokenFromCookie(c.req.header('cookie'), getEnv().SESSION_COOKIE_NAME);
  const currentHash = currentToken ? hashSecret(currentToken) : null;

  return c.json({
    success: true,
    data: sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ip: s.ip,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      current: s.tokenHash === currentHash,
    })),
  });
});

auth.delete('/sessions/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const db = getDb();

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, userId)),
  });

  if (!session) {
    throw new NotFoundError('Session', sessionId);
  }

  await revokeSession(session.tokenHash);

  auditLog({
    userId,
    action: 'session.revoke',
    resourceType: 'session',
    resourceId: sessionId,
  });

  return c.json({ success: true });
});

export default auth;
