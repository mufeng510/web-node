import type { Context, Next } from 'hono';
import { getDb } from '../db/index.js';
import { auditLogs } from '../db/schema/audit.js';
import { createId } from '../utils/id.js';

export interface AuditContext {
  userId?: string;
  libraryId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

const auditQueue: AuditContext[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;

export function auditLog(context: AuditContext) {
  auditQueue.push({
    ...context,
    ip: context.ip || 'unknown',
    userAgent: context.userAgent || 'unknown',
  });

  if (!flushInterval) {
    flushInterval = setInterval(flushAuditLogs, 5000);
  }
}

async function flushAuditLogs() {
  if (auditQueue.length === 0) return;

  const logs = auditQueue.splice(0, auditQueue.length);

  try {
    const db = getDb();
    await db.insert(auditLogs).values(
      logs.map((log) => ({
        id: createId(),
        userId: log.userId,
        libraryId: log.libraryId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata,
        ip: log.ip,
        userAgent: log.userAgent,
      }))
    );
  } catch (error) {
    console.error('Failed to write audit logs:', error);
    auditQueue.unshift(...logs);
  }
}

export async function flushAuditLogsNow() {
  await flushAuditLogs();
}

export function auditMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    await next();

    const duration = Date.now() - startTime;
    const requestId = c.get('requestId');

    if (c.req.path.startsWith('/api/') && !c.req.path.includes('/health')) {
      auditLog({
        userId: c.get('userId'),
        libraryId: c.get('libraryId'),
        action: `api.${c.req.method.toLowerCase()}.${c.req.path.replace(/^\/api\/v\d+\//, '').replace(/\//g, '.')}`,
        resourceType: 'api',
        resourceId: requestId,
        metadata: {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          duration,
        },
        ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
        userAgent: c.req.header('user-agent') || 'unknown',
      });
    }
  };
}
