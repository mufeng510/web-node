import { zValidator } from '@hono/zod-validator';
import { desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { webhooks } from '../../db/schema/webhooks.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import type { Env } from '../../middleware/env.js';
import { encrypt } from '../../utils/crypto.js';
import { NotFoundError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

const webhookRoutes = new Hono<Env>();

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

    const results = await db
      .select()
      .from(webhooks)
      .where(cursor ? gt(webhooks.createdAt, new Date(cursor)) : undefined)
      .orderBy(desc(webhooks.createdAt))
      .limit(limit + 1)
      .execute();
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

export default webhookRoutes;
