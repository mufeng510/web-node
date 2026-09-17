import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { notifications } from '../../db/schema/notifications.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const notificationRoutes = new Hono();

notificationRoutes.use('*', authMiddleware());

notificationRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
      unreadOnly: z.coerce.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { limit, cursor, unreadOnly } = c.req.valid('query');
    const db = getDb();

    let query = db.select().from(notifications).where(eq(notifications.userId, userId));

    if (unreadOnly) {
      query = query.where(eq(notifications.read, false));
    }

    if (cursor) {
      query = query.where(gt(notifications.createdAt, new Date(cursor)));
    }

    query = query.orderBy(desc(notifications.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

notificationRoutes.post('/:id/read', async (c) => {
  const userId = c.get('userId');
  const notificationId = c.req.param('id');
  const db = getDb();

  const notification = await db.query.notifications.findFirst({
    where: and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
  });
  if (!notification) throw new NotFoundError('Notification', notificationId);

  await db.update(notifications).set({ read: true }).where(eq(notifications.id, notificationId));

  return c.json({ success: true });
});

notificationRoutes.post('/read-all', async (c) => {
  const userId = c.get('userId');
  const db = getDb();

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

  return c.json({ success: true });
});

function gt(column: any, value: any) {
  return { gt: [column, value] };
}

export default notificationRoutes;
