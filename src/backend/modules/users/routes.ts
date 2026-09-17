import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { hashPassword } from '../auth/password.js';
import { auditLog } from '../middleware/audit.js';
import { getUserSessions, revokeAllSessions } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { createId } from '../utils/id.js';

const usersRouter = new Hono();

usersRouter.use('*', authMiddleware(['admin']));

usersRouter.get('/', async (c) => {
  const db = getDb();
  const allUsers = await db.query.users.findMany({
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({
    success: true,
    data: allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      failedLoginAttempts: u.failedLoginAttempts,
      lockedUntil: u.lockedUntil,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
  });
});

usersRouter.post(
  '/',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      role: z.enum(['admin', 'user']).default('user'),
    })
  ),
  async (c) => {
    const { email, password, role } = c.req.valid('json');
    const db = getDb();

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new ValidationError('Email already in use');

    const passwordHash = await hashPassword(password);
    const userId = createId();

    await db.insert(users).values({ id: userId, email, passwordHash, role });

    auditLog({
      userId: c.get('userId'),
      action: 'user.create',
      resourceType: 'user',
      resourceId: userId,
      metadata: { email, role },
    });

    return c.json({ success: true, data: { id: userId, email, role } }, 201);
  }
);

usersRouter.get('/:id', async (c) => {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, c.req.param('id')) });
  if (!user) throw new NotFoundError('User', c.req.param('id'));

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

usersRouter.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      email: z.string().email().optional(),
      role: z.enum(['admin', 'user']).optional(),
      isActive: z.boolean().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const db = getDb();

    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) throw new NotFoundError('User', id);

    if (data.email) {
      const existing = await db.query.users.findFirst({ where: eq(users.email, data.email) });
      if (existing && existing.id !== id) throw new ValidationError('Email already in use');
    }

    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id));

    auditLog({
      userId: c.get('userId'),
      action: 'user.update',
      resourceType: 'user',
      resourceId: id,
      metadata: data,
    });

    return c.json({ success: true });
  }
);

usersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new NotFoundError('User', id);

  if (user.role === 'admin') {
    const adminCount = await db.$count(users, eq(users.role, 'admin'));
    if (adminCount <= 1) throw new ValidationError('Cannot delete the last admin user');
  }

  await db.delete(users).where(eq(users.id, id));

  auditLog({
    userId: c.get('userId'),
    action: 'user.delete',
    resourceType: 'user',
    resourceId: id,
  });

  return c.json({ success: true });
});

usersRouter.post('/:id/unlock', async (c) => {
  const db = getDb();
  const id = c.req.param('id');

  await db
    .update(users)
    .set({ isActive: true, lockedUntil: null, failedLoginAttempts: 0 })
    .where(eq(users.id, id));

  auditLog({
    userId: c.get('userId'),
    action: 'user.unlock',
    resourceType: 'user',
    resourceId: id,
  });

  return c.json({ success: true });
});

usersRouter.get('/:id/sessions', async (c) => {
  const sessions = await getUserSessions(c.req.param('id'));
  return c.json({
    success: true,
    data: sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ip: s.ip,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    })),
  });
});

usersRouter.delete('/:id/sessions', async (c) => {
  await revokeAllSessions(c.req.param('id'));

  auditLog({
    userId: c.get('userId'),
    action: 'session.revoke_all',
    resourceType: 'user',
    resourceId: c.req.param('id'),
  });

  return c.json({ success: true });
});

export default usersRouter;
