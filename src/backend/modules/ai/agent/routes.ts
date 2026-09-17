import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { taskSteps, tasks } from '../../../db/schema/tasks.js';
import { checkLibraryAccess } from '../../libraries/access.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

const agentRoutes = new Hono();

agentRoutes.use('*', authMiddleware());

agentRoutes.post(
  '/tasks',
  zValidator(
    'json',
    z.object({
      conversationId: z.string().uuid(),
      goal: z.string().min(1).max(5000),
      libraryId: z.string().uuid(),
      providerId: z.string().uuid().optional(),
      model: z.string().optional(),
      parameters: z
        .object({
          temperature: z.number().min(0).max(2).optional(),
          topP: z.number().min(0).max(1).optional(),
          maxTokens: z.number().int().positive().optional(),
        })
        .optional(),
      permissions: z
        .object({
          read: z.enum(['allow', 'ask', 'deny']).default('allow'),
          search: z.enum(['allow', 'ask', 'deny']).default('allow'),
          create: z.enum(['allow', 'ask', 'deny']).default('ask'),
          edit: z.enum(['allow', 'ask', 'deny']).default('ask'),
          delete: z.enum(['allow', 'ask', 'deny']).default('ask'),
          gitCommit: z.enum(['allow', 'ask', 'deny']).default('ask'),
          gitPush: z.enum(['allow', 'ask', 'deny']).default('ask'),
          gitPull: z.enum(['allow', 'ask', 'deny']).default('ask'),
        })
        .optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const {
      conversationId,
      goal,
      libraryId,
      providerId,
      model,
      parameters,
      permissions: _permissions,
    } = c.req.valid('json');
    const db = getDb();

    await checkLibraryAccess(userId, libraryId);

    const taskId = createId();
    await db.insert(tasks).values({
      id: taskId,
      conversationId,
      userId,
      libraryId,
      goal,
      providerId,
      model,
      parameters,
      status: 'pending',
    });

    auditLog({
      userId,
      libraryId,
      action: 'agent.task.start',
      resourceType: 'task',
      resourceId: taskId,
      metadata: { goal: goal.slice(0, 100) },
    });

    return c.json({ success: true, data: { id: taskId, status: 'pending' } }, 201);
  }
);

agentRoutes.get(
  '/tasks',
  zValidator(
    'query',
    z.object({
      libraryId: z.string().uuid().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { libraryId, status, limit, cursor } = c.req.valid('query');
    const db = getDb();

    let query = db.select().from(tasks).where(eq(tasks.userId, userId));

    if (libraryId) {
      await checkLibraryAccess(userId, libraryId);
      query = query.where(eq(tasks.libraryId, libraryId));
    }

    if (status) {
      query = query.where(eq(tasks.status, status));
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

agentRoutes.get('/tasks/:id', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });

  if (!task) throw new NotFoundError('Task', taskId);

  await checkLibraryAccess(userId, task.libraryId);

  return c.json({ success: true, data: task });
});

agentRoutes.post('/tasks/:id/cancel', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });

  if (!task) throw new NotFoundError('Task', taskId);

  if (!['pending', 'running', 'waiting', 'paused'].includes(task.status)) {
    throw new ValidationError('Task cannot be cancelled');
  }

  await db
    .update(tasks)
    .set({ status: 'cancelled', finishedAt: new Date() })
    .where(eq(tasks.id, taskId));

  auditLog({
    userId,
    libraryId: task.libraryId,
    action: 'agent.task.cancel',
    resourceType: 'task',
    resourceId: taskId,
  });

  return c.json({ success: true });
});

agentRoutes.post('/tasks/:id/rerun', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });

  if (!task) throw new NotFoundError('Task', taskId);

  await checkLibraryAccess(userId, task.libraryId);

  const newTaskId = createId();
  await db.insert(tasks).values({
    id: newTaskId,
    conversationId: task.conversationId,
    userId,
    libraryId: task.libraryId,
    goal: task.goal,
    plan: task.plan,
    providerId: task.providerId,
    model: task.model,
    parameters: task.parameters,
    status: 'pending',
  });

  auditLog({
    userId,
    libraryId: task.libraryId,
    action: 'agent.task.rerun',
    resourceType: 'task',
    resourceId: newTaskId,
    metadata: { originalTaskId: taskId },
  });

  return c.json({ success: true, data: { id: newTaskId, status: 'pending' } });
});

agentRoutes.post(
  '/tasks/:id/approve',
  zValidator(
    'json',
    z.object({
      stepIndex: z.number().int().nonnegative(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const taskId = c.req.param('id');
    const { stepIndex } = c.req.valid('json');
    const db = getDb();

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
    });

    if (!task) throw new NotFoundError('Task', taskId);

    if (task.status !== 'waiting') throw new ValidationError('Task is not waiting for approval');

    await db
      .update(taskSteps)
      .set({ status: 'approved' })
      .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.stepIndex, stepIndex)));
    await db.update(tasks).set({ status: 'running' }).where(eq(tasks.id, taskId));

    return c.json({ success: true });
  }
);

agentRoutes.post(
  '/tasks/:id/reject',
  zValidator(
    'json',
    z.object({
      stepIndex: z.number().int().nonnegative(),
      reason: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const taskId = c.req.param('id');
    const { stepIndex, reason } = c.req.valid('json');
    const db = getDb();

    const task = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
    });

    if (!task) throw new NotFoundError('Task', taskId);

    await db
      .update(taskSteps)
      .set({ status: 'rejected', error: reason })
      .where(and(eq(taskSteps.taskId, taskId), eq(taskSteps.stepIndex, stepIndex)));
    await db.update(tasks).set({ status: 'running' }).where(eq(tasks.id, taskId));

    return c.json({ success: true });
  }
);

agentRoutes.get('/tasks/:id/steps', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('id');
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });

  if (!task) throw new NotFoundError('Task', taskId);

  const steps = await db.query.taskSteps.findMany({
    where: eq(taskSteps.taskId, taskId),
    orderBy: (taskSteps, { asc }) => [asc(taskSteps.stepIndex)],
  });

  return c.json({ success: true, data: { steps } });
});

export default agentRoutes;
