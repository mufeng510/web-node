import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { closeDb } from './db/index.js';
import { flushAuditLogsNow } from './middleware/audit.js';

const app = createApp();
const env = getEnv();

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${new Date().toISOString()}] Received ${signal}, starting graceful shutdown...`);

  try {
    await flushAuditLogsNow();
    console.log('Audit logs flushed');
  } catch (error) {
    console.error('Failed to flush audit logs:', error);
  }

  try {
    closeDb();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Failed to close database:', error);
  }

  console.log('[SHUTDOWN] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(
      `[${new Date().toISOString()}] Web Note server started on http://${info.address}:${info.port}`
    );
    console.log(`[${new Date().toISOString()}] Environment: ${env.NODE_ENV}`);
    console.log(`[${new Date().toISOString()}] Data root: ${env.DATA_ROOT}`);
    console.log(`[${new Date().toISOString()}] App data root: ${env.APP_DATA_ROOT}`);
  }
);
