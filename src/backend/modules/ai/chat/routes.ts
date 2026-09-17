import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { conversations, messages } from '../../../db/schema/conversations.js';
import { auditLog } from '../../../middleware/audit.js';
import { authMiddleware } from '../../../middleware/auth.middleware.js';
import { NotFoundError } from '../../../utils/errors.js';
import { createId } from '../../../utils/id.js';
import { checkLibraryAccess } from '../../libraries/access.js';

const chatRoutes = new Hono();

chatRoutes.use('*', authMiddleware());

chatRoutes.post(
  '/conversations',
  zValidator(
    'json',
    z.object({
      libraryId: z.string().uuid(),
      title: z.string().max(255).optional(),
      initialMessage: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { libraryId, title, initialMessage } = c.req.valid('json');
    const db = getDb();

    await checkLibraryAccess(userId, libraryId);

    const conversationId = createId();
    const convTitle = title || (initialMessage ? initialMessage.slice(0, 50) : 'New Conversation');

    await db.insert(conversations).values({
      id: conversationId,
      libraryId,
      userId,
      title: convTitle,
    });

    let firstMessageId: string | undefined;

    if (initialMessage) {
      firstMessageId = createId();
      await db.insert(messages).values({
        id: firstMessageId,
        conversationId,
        role: 'user',
        content: initialMessage,
      });
      await db
        .update(conversations)
        .set({ messageCount: 1 })
        .where(eq(conversations.id, conversationId));
    }

    auditLog({
      userId,
      libraryId,
      action: 'ai.chat.create',
      resourceType: 'conversation',
      resourceId: conversationId,
    });

    return c.json(
      { success: true, data: { id: conversationId, title: convTitle, messageId: firstMessageId } },
      201
    );
  }
);

chatRoutes.get(
  '/conversations',
  zValidator(
    'query',
    z.object({
      libraryId: z.string().uuid().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { libraryId, limit, cursor } = c.req.valid('query');
    const db = getDb();

    let query = db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.isDeleted, false)));

    if (libraryId) {
      query = query.where(eq(conversations.libraryId, libraryId));
    }

    if (cursor) {
      query = query.where(gt(conversations.updatedAt, new Date(cursor)));
    }

    query = query.orderBy(desc(conversations.updatedAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : undefined;

    return c.json({
      success: true,
      data: { items, nextCursor, hasMore },
    });
  }
);

chatRoutes.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const conversationId = c.req.param('id');
  const db = getDb();

  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
  });

  if (!conversation) throw new NotFoundError('Conversation', conversationId);

  await checkLibraryAccess(userId, conversation.libraryId);

  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
  });

  return c.json({
    success: true,
    data: { ...conversation, messages: msgs },
  });
});

chatRoutes.patch(
  '/conversations/:id',
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

chatRoutes.delete('/conversations/:id', async (c) => {
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

  auditLog({
    userId,
    libraryId: conversation.libraryId,
    action: 'ai.chat.delete',
    resourceType: 'conversation',
    resourceId: conversationId,
  });

  return c.json({ success: true });
});

chatRoutes.post(
  '/conversations/:id/messages',
  zValidator(
    'json',
    z.object({
      content: z.string().min(1),
      role: z.enum(['user', 'assistant']).default('user'),
      selectedText: z.string().optional(),
      noteId: z.string().optional(),
      contextFiles: z.array(z.string()).optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    const { content, role, selectedText, noteId, contextFiles } = c.req.valid('json');
    const db = getDb();

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });

    if (!conversation) throw new NotFoundError('Conversation', conversationId);

    await checkLibraryAccess(userId, conversation.libraryId);

    const messageId = createId();
    await db.insert(messages).values({
      id: messageId,
      conversationId,
      role,
      content,
      metadata: { selectedText, noteId, contextFiles },
    });

    await db
      .update(conversations)
      .set({ messageCount: { increment: 1 }, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return c.json({ success: true, data: { id: messageId } });
  }
);

chatRoutes.get(
  '/conversations/:id/messages',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(100).default(50),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const conversationId = c.req.param('id');
    const { limit, cursor } = c.req.valid('query');
    const db = getDb();

    const conversation = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });

    if (!conversation) throw new NotFoundError('Conversation', conversationId);

    let query = db.select().from(messages).where(eq(messages.conversationId, conversationId));

    if (cursor) {
      query = query.where(gt(messages.createdAt, new Date(cursor)));
    }

    query = query.orderBy(asc(messages.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

function asc<T>(_fn: (t: T) => unknown) {
  return { asc: true };
}

function gt(column: string, value: Date | string | number) {
  return { gt: [column, value] };
}

export default chatRoutes;
