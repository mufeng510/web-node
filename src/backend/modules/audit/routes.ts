import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { auditLogs } from '../db/schema/audit.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const auditRoutes = new Hono();

auditRoutes.use('*', authMiddleware(['admin']));

auditRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      userId: z.string().uuid().optional(),
      libraryId: z.string().uuid().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.coerce.number().int().positive().max(500).default(50),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const { userId, libraryId, action, resourceType, startDate, endDate, limit, cursor } =
      c.req.valid('query');
    const db = getDb();

    let query = db.select().from(auditLogs);

    if (userId) query = query.where(eq(auditLogs.userId, userId));
    if (libraryId) query = query.where(eq(auditLogs.libraryId, libraryId));
    if (action) query = query.where(like(auditLogs.action, `%${action}%`));
    if (resourceType) query = query.where(eq(auditLogs.resourceType, resourceType));
    if (startDate) query = query.where(gte(auditLogs.createdAt, new Date(startDate)));
    if (endDate) query = query.where(lte(auditLogs.createdAt, new Date(endDate)));
    if (cursor) query = query.where(gt(auditLogs.createdAt, new Date(cursor)));

    query = query.orderBy(desc(auditLogs.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

function like(column: string, pattern: string) {
  return { like: [column, pattern] };
}

function gte(column: string, value: Date | string | number) {
  return { gte: [column, value] };
}

function lte(column: string, value: Date | string | number) {
  return { lte: [column, value] };
}

function gt(column: string, value: Date | string | number) {
  return { gt: [column, value] };
}

export default auditRoutes;
