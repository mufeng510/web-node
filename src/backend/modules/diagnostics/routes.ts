import { Hono } from 'hono';
import { getEnv } from '../../config/env.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { getDb } from '../db/index.js';

const diagnosticsRoutes = new Hono();

diagnosticsRoutes.use('*', authMiddleware(['admin']));

diagnosticsRoutes.get('/health', async (c) => {
  const db = getDb();
  const env = getEnv();

  const checks: Record<string, boolean> = {
    database: false,
    dataRoot: false,
    appDataRoot: false,
    migrations: false,
  };

  try {
    db.$client.prepare('SELECT 1').get();
    checks.database = true;
  } catch {}

  try {
    await import('node:fs/promises').then((fs) => fs.access(env.DATA_ROOT));
    checks.dataRoot = true;
  } catch {}

  try {
    await import('node:fs/promises').then((fs) => fs.access(env.APP_DATA_ROOT));
    checks.appDataRoot = true;
  } catch {}

  try {
    const _result = await db.$client.prepare('SELECT * FROM drizzle_migrations').all();
    checks.migrations = true;
  } catch {}

  const healthy = Object.values(checks).every((v) => v === true);

  return c.json(
    { success: true, data: { healthy, checks, timestamp: new Date().toISOString() } },
    healthy ? 200 : 503
  );
});

diagnosticsRoutes.get('/status', async (c) => {
  const db = getDb();
  const env = getEnv();

  const dbSize = db.$client
    .prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
    .get() as { size: number } | undefined;
  const userCount = db.$client.prepare('SELECT COUNT(*) as count FROM users').get() as
    | { count: number }
    | undefined;
  const libraryCount = db.$client.prepare('SELECT COUNT(*) as count FROM libraries').get() as
    | { count: number }
    | undefined;
  const fileCount = db.$client.prepare('SELECT COUNT(*) as count FROM files').get() as
    | { count: number }
    | undefined;
  const sessionCount = db.$client
    .prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime("now")')
    .get() as { count: number } | undefined;

  return c.json({
    success: true,
    data: {
      version: '0.1.0',
      environment: env.NODE_ENV,
      database: {
        size: dbSize?.size || 0,
        tables: {
          users: userCount?.count || 0,
          libraries: libraryCount?.count || 0,
          files: fileCount?.count || 0,
          activeSessions: sessionCount?.count || 0,
        },
      },
      storage: { dataRoot: env.DATA_ROOT, appDataRoot: env.APP_DATA_ROOT },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    },
  });
});

diagnosticsRoutes.get('/export', async (c) => {
  const db = getDb();

  const tables = [
    'users',
    'sessions',
    'libraries',
    'library_members',
    'files',
    'search_index',
    'ai_indexes',
    'ai_index_chunks',
    'conversations',
    'messages',
    'tasks',
    'task_steps',
    'task_rollbacks',
    'audit_logs',
    'git_configs',
    'git_commits',
    'providers',
    'mcp_tokens',
    'settings',
    'db_backups',
  ];

  const exportData: Record<string, unknown[]> = {};

  for (const table of tables) {
    try {
      const rows = db.$client.prepare(`SELECT * FROM ${table}`).all();
      exportData[table] = rows.map((row: Record<string, unknown>) => {
        const sanitized = { ...row };
        sanitized.passwordHash = undefined;
        sanitized.tokenHash = undefined;
        sanitized.apiKey = undefined;
        sanitized.credentials = undefined;
        return sanitized;
      });
    } catch {}
  }

  return c.json({ success: true, data: exportData });
});

export default diagnosticsRoutes;
