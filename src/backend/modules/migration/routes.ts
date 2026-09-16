import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { getDb } from '../db/index.js';

const migrationRoutes = new Hono();

migrationRoutes.use('*', authMiddleware(['admin']));

migrationRoutes.get('/status', async (c) => {
  const db = getDb();

  try {
    const result = await db.$client
      .prepare('SELECT * FROM drizzle_migrations ORDER BY created_at DESC')
      .all();
    return c.json({ success: true, data: { migrations: result } });
  } catch {
    return c.json({ success: true, data: { migrations: [] } });
  }
});

migrationRoutes.post('/run', async (c) => {
  return c.json(
    { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Use CLI for migrations' } },
    501
  );
});

export default migrationRoutes;
