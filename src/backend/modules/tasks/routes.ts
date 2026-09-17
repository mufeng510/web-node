import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { tasks } from '../db/schema/tasks.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { NotFoundError } from '../utils/errors.js';

const taskRoutes = new Hono();

taskRoutes.use('*', authMiddleware());

taskRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      userId: z.string().uuid().optional(),
      libraryId: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const { userId: targetUserId, libraryId, status, limit, cursor } = c.req.valid('query');
    const db = getDb();

    let query = db.select().from(tasks);

    if (userRole === 'admin' && targetUserId) {
      query = query.where(eq(tasks.userId, targetUserId));
    } else {
      query = query.where(eq(tasks.userId, userId));
    }

    if (libraryId) {
      query = query.where(eq(tasks.libraryId, libraryId));
    }

    if (status) {
      query = query.where(eq(tasks.status, status as any));
    }

    if (cursor) {
      query = query.where(gt(tasks.createdAt, new Date(cursor)));
    }

    query = query.orderBy(desc(tasks.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

taskRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) throw new NotFoundError('Task', taskId);

  if (userRole !== 'admin' && task.userId !== userId) {
    throw new NotFoundError('Task', taskId);
  }

  return c.json({ success: true, data: task });
});

taskRoutes.get('/:id/logs', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) throw new NotFoundError('Task', taskId);

  if (userRole !== 'admin' && task.userId !== userId) {
    throw new NotFoundError('Task', taskId);
  }

  const { taskSteps } = await import('../db/schema/tasks.js');
  const { asc } = await import('drizzle-orm');

  const steps = await db.query.taskSteps.findMany({
    where: eq(taskSteps.taskId, taskId),
    orderBy: (taskSteps, { asc }) => [asc(taskSteps.stepIndex)],
  });

  return c.json({ success: true, data: { steps } });
});

export default taskRoutes;
