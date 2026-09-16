import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { getDb } from '../db/index.js';
import { settings } from '../db/schema/settings.js';

const settingsRoutes = new Hono();

settingsRoutes.use('*', authMiddleware());

settingsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = getDb();

  const userSettings = await db.query.settings.findFirst({
    where: eq(settings.key, `user:${userId}`),
  });
  const systemSettings = await db.query.settings.findFirst({ where: eq(settings.key, 'system') });

  return c.json({
    success: true,
    data: { user: userSettings?.value || {}, system: systemSettings?.value || {} },
  });
});

settingsRoutes.patch(
  '/',
  zValidator(
    'json',
    z.object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      fontFamily: z.string().optional(),
      fontSize: z.number().int().positive().optional(),
      language: z.enum(['en', 'zh-CN']).optional(),
      autosaveDebounceMs: z.number().int().positive().optional(),
      maxFileSizeMb: z.number().int().positive().optional(),
      trashRetentionDays: z.number().int().nonnegative().optional(),
      sessionMaxAgeDays: z.number().int().positive().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const data = c.req.valid('json');
    const db = getDb();

    const existing = await db.query.settings.findFirst({
      where: eq(settings.key, `user:${userId}`),
    });
    const current = existing?.value || {};

    await db
      .insert(settings)
      .values({
        key: `user:${userId}`,
        value: { ...current, ...data },
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: { ...current, ...data }, updatedAt: new Date() },
      });

    return c.json({ success: true });
  }
);

export default settingsRoutes;
