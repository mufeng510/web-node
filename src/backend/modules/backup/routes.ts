import { copyFile } from 'node:fs/promises';
import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { dbBackups } from '../../db/schema/settings.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { NotFoundError } from '../utils/errors.js';
import { createId } from '../utils/id.js';

const backupRoutes = new Hono();

backupRoutes.use('*', authMiddleware(['admin']));

backupRoutes.get(
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

    let query = db.select().from(dbBackups);

    if (cursor) {
      query = query.where(gt(dbBackups.createdAt, new Date(cursor)));
    }

    query = query.orderBy(desc(dbBackups.createdAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

    return c.json({ success: true, data: { items, nextCursor, hasMore } });
  }
);

backupRoutes.post('/', async (c) => {
  const db = getDb();
  const env = getEnv();

  const backupId = createId();
  const sourcePath = env.DATABASE_URL.replace('file:', '');
  const backupDir = `${env.APP_DATA_ROOT}/backups`;
  const backupPath = `${backupDir}/webnote_${new Date().toISOString().replace(/[:.]/g, '-')}_${backupId}.db`;

  await import('node:fs/promises').then((fs) => fs.mkdir(backupDir, { recursive: true }));
  await copyFile(sourcePath, backupPath);

  const stats = await import('node:fs/promises').then((fs) => fs.stat(backupPath));

  await db.insert(dbBackups).values({
    id: backupId,
    path: backupPath,
    size: stats.size,
    status: 'completed',
  });

  return c.json({ success: true, data: { id: backupId, path: backupPath, size: stats.size } });
});

backupRoutes.get('/:id', async (c) => {
  const backupId = c.req.param('id');
  const db = getDb();

  const backup = await db.query.dbBackups.findFirst({ where: eq(dbBackups.id, backupId) });
  if (!backup) throw new NotFoundError('Backup', backupId);

  return c.json({ success: true, data: backup });
});

function gt(column: string, value: Date | string | number) {
  return { gt: [column, value] };
}

export default backupRoutes;
