import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getEnv } from './config/env.js';
import { getDb } from './db/index.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler } from './middleware/error.js';
import aiAgentRoutes from './modules/ai/agent/routes.js';
import aiChatRoutes from './modules/ai/chat/routes.js';
import conversationRoutes from './modules/ai/conversations/routes.js';
import aiIndexRoutes from './modules/ai/index/routes.js';
import aiProviderRoutes from './modules/ai/providers/routes.js';
import auditRoutes from './modules/audit/routes.js';
import authRoutes from './modules/auth/routes.js';
import backupRoutes from './modules/backup/routes.js';
import diagnosticsRoutes from './modules/diagnostics/routes.js';
import editorRoutes from './modules/editor/routes.js';
import fileRoutes from './modules/files/routes.js';
import gitRoutes from './modules/git/routes.js';
import libraryRoutes from './modules/libraries/routes.js';
import mcpRoutes from './modules/mcp/routes.js';
import migrationRoutes from './modules/migration/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import searchRoutes from './modules/search/routes.js';
import settingsRoutes from './modules/settings/routes.js';
import taskRoutes from './modules/tasks/routes.js';
import userRoutes from './modules/users/routes.js';
import webhookRoutes from './modules/webhooks/routes.js';

export function createApp() {
  const env = getEnv();
  const app = new Hono();

  app.use('*', logger());
  app.use('*', async (c: Context, next: Next) => {
    const requestId = c.req.header('x-request-id') || createId();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    await next();
  });
  app.use('*', errorHandler);
  app.use('*', auditMiddleware());

  app.use(
    '/api/*',
    cors({
      origin: env.FRONTEND_URL || '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-request-id'],
      exposeHeaders: ['x-request-id'],
      credentials: true,
      maxAge: 86400,
    })
  );

  app.get('/health', (c) => {
    const db = getDb();
    try {
      db.$client.prepare('SELECT 1').get();
      return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch {
      return c.json({ status: 'unhealthy', timestamp: new Date().toISOString() }, 503);
    }
  });

  const api = app.basePath('/api/v1');
  api.route('/auth', authRoutes);
  api.route('/users', userRoutes);
  api.route('/libraries', libraryRoutes);
  api.route('/files', fileRoutes);
  api.route('/search', searchRoutes);
  api.route('/editor', editorRoutes);
  api.route('/git', gitRoutes);
  api.route('/ai/providers', aiProviderRoutes);
  api.route('/ai/chat', aiChatRoutes);
  api.route('/ai/agent', aiAgentRoutes);
  api.route('/ai/index', aiIndexRoutes);
  api.route('/ai/conversations', conversationRoutes);
  api.route('/mcp', mcpRoutes);
  api.route('/tasks', taskRoutes);
  api.route('/audit', auditRoutes);
  api.route('/backup', backupRoutes);
  api.route('/migration', migrationRoutes);
  api.route('/diagnostics', diagnosticsRoutes);
  api.route('/notifications', notificationRoutes);
  api.route('/webhooks', webhookRoutes);
  api.route('/settings', settingsRoutes);

  return app;
}

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}
