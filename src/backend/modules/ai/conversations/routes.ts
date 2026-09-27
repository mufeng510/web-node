import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { conversations } from '../../../db/schema/conversations.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { NotFoundError } from '../../../utils/errors.js';
import { checkLibraryAccess } from '../../libraries/access.js';

const conversationRoutes = new Hono();

conversationRoutes.use('*', authMiddleware());

conversationRoutes.get(
  '/',
  zValidator(
    'query',
    z.object({
      libraryId: z.string().min(1).optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { libraryId, limit, cursor } = c.req.valid('query');
    const db = getDb();

    const conditions = [and(eq(conversations.userId, userId), eq(conversations.isDeleted, false))];

    if (libraryId) {
      await checkLibraryAccess(userId, libraryId);
      conditions.push(eq(conversations.libraryId, libraryId));
    }

    if (cursor) {
      conditions.push(gt(conversations.updatedAt, new Date(cursor)));
    }

    const query = db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

conversationRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');
  const db = getDb();

  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
  });

  if (!conversation) throw new NotFoundError('Conversation', conversationId);

  await checkLibraryAccess(userId, conversation.libraryId);

  return c.json({ success: true, data: conversation });
});

conversationRoutes.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      title: z.string().max(255).optional(),
      currentNoteId: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    const { title, currentNoteId } = c.req.valid('json');
    const db = getDb();

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });

    if (!conversation) throw new NotFoundError('Conversation', conversationId);

    await checkLibraryAccess(userId, conversation.libraryId);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title) updates.title = title;
    if (currentNoteId) updates.currentNoteId = currentNoteId;

    await db.update(conversations).set(updates).where(eq(conversations.id, conversationId));

    return c.json({ success: true });
  }
);

conversationRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');
  const db = getDb();

  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
  });

  if (!conversation) throw new NotFoundError('Conversation', conversationId);

  await checkLibraryAccess(userId, conversation.libraryId);

  await db
    .update(conversations)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return c.json({ success: true });
});

export default conversationRoutes;
