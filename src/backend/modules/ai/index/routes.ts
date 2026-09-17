import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../../../db/index.js';
import { aiIndexes } from '../../../db/schema/ai_index.js';
import { providers } from '../../../db/schema/providers.js';
import { checkLibraryAccess } from '../libraries/access.js';
import { auditLog } from '../middleware/audit.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { NotFoundError } from '../utils/errors.js';

const indexRoutes = new Hono();

indexRoutes.use('*', authMiddleware());

indexRoutes.get('/:libraryId/status', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  await checkLibraryAccess(userId, libraryId);
  const db = getDb();

  const index = await db.query.aiIndexes.findFirst({ where: eq(aiIndexes.libraryId, libraryId) });

  if (!index) {
    return c.json({ success: true, data: { status: 'not_initialized' } });
  }

  return c.json({ success: true, data: index });
});

indexRoutes.post('/:libraryId/rebuild', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  await checkLibraryAccess(userId, libraryId, 'admin');
  const db = getDb();

  let index = await db.query.aiIndexes.findFirst({ where: eq(aiIndexes.libraryId, libraryId) });

  if (!index) {
    const provider = await db.query.providers.findFirst({ where: eq(providers.isDefault, true) });
    if (!provider) throw new NotFoundError('Default provider not found');

    const indexId = createId();
    await db.insert(aiIndexes).values({
      id: indexId,
      libraryId,
      providerId: provider.id,
      embedModel: provider.embedModel || 'text-embedding-3-small',
      status: 'indexing',
    });
    index = await db.query.aiIndexes.findFirst({ where: eq(aiIndexes.id, indexId) });
  } else {
    await db
      .update(aiIndexes)
      .set({ status: 'indexing', progress: 0 })
      .where(eq(aiIndexes.libraryId, libraryId));
  }

  auditLog({
    userId,
    libraryId,
    action: 'ai.index.rebuild',
    resourceType: 'ai_index',
    resourceId: index.id,
  });

  return c.json({ success: true, data: { status: 'indexing' } });
});

indexRoutes.post('/:libraryId/pause', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  await checkLibraryAccess(userId, libraryId, 'admin');
  const db = getDb();

  await db.update(aiIndexes).set({ status: 'paused' }).where(eq(aiIndexes.libraryId, libraryId));

  return c.json({ success: true });
});

indexRoutes.post('/:libraryId/resume', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  await checkLibraryAccess(userId, libraryId, 'admin');
  const db = getDb();

  await db.update(aiIndexes).set({ status: 'indexing' }).where(eq(aiIndexes.libraryId, libraryId));

  return c.json({ success: true });
});

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

export default indexRoutes;
