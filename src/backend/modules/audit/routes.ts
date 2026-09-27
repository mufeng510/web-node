import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gte, like, lt, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

const auditRoutes = new Hono();

auditRoutes.use('*', authMiddleware(['admin']));

auditRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      userId: z.string().min(1).optional(),
      libraryId: z.string().min(1).optional(),
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

    const conditions = [];

    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (libraryId) conditions.push(eq(auditLogs.libraryId, libraryId));
    if (action) conditions.push(like(auditLogs.action, `%${action}%`));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    if (cursor) conditions.push(lt(auditLogs.createdAt, new Date(cursor)));

    const query = db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

export default auditRoutes;
