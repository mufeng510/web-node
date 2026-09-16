import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { encrypt } from '../../utils/crypto.js';
import { NotFoundError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';
import { getDb } from '../db/index.js';
import { webhooks } from '../db/schema/webhooks.js';

const webhookRoutes = new Hono();

webhookRoutes.use('*', authMiddleware(['admin']));

webhookRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const { limit, cursor } = c.req.valid('query');
    const db = getDb();

    let query = db.select().from(webhooks);

    if (cursor) {
      query = query.where(gt(webhooks.createdAt, new Date(cursor)));
    }

    query = query.orderBy(desc(webhooks.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

webhookRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      secret: z.string().min(16).optional(),
    })
  ),
  async (c) => {
    const { name, url, events, secret } = c.req.valid('json');
    const db = getDb();

    const webhookId = createId();
    await db.insert(webhooks).values({
      id: webhookId,
      name,
      url,
      events,
      secret: secret ? encrypt(secret) : null,
    });

    auditLog({
      userId: c.get('userId'),
      action: 'webhook.create',
      resourceType: 'webhook',
      resourceId: webhookId,
    });

    return c.json({ success: true, data: { id: webhookId } }, 201);
  }
);

webhookRoutes.delete('/:id', async (c) => {
  const webhookId = c.req.param('id');
  const db = getDb();

  const webhook = await db.query.webhooks.findFirst({ where: eq(webhooks.id, webhookId) });
  if (!webhook) throw new NotFoundError('Webhook', webhookId);

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));

  return c.json({ success: true });
});

function gt(column: unknown, value: Date) {
  return { gt: [column, value] };
}

export default webhookRoutes;
