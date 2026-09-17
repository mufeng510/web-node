import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../../db/index.js';
import { providers } from '../../../db/schema/providers.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

const providerRoutes = new Hono();

providerRoutes.use('*', authMiddleware(['admin']));

providerRoutes.get('/', async (c) => {
  const db = getDb();
  const allProviders = await db.query.providers.findMany({
    orderBy: (providers, { desc }) => [desc(providers.createdAt)],
  });

  return c.json({
    success: true,
    data: allProviders.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      chatModel: p.chatModel,
      embedModel: p.embedModel,
      rerankModel: p.rerankModel,
      capabilities: p.capabilities,
      isDefault: p.isDefault,
      discoveredModels: p.discoveredModels,
      lastTestedAt: p.lastTestedAt,
      lastTestResult: p.lastTestResult,
    })),
  });
});

providerRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      type: z.enum(['openai', 'ollama', 'lm-studio', 'custom']),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
      chatModel: z.string().min(1),
      embedModel: z.string().optional(),
      rerankModel: z.string().optional(),
      customHeaders: z.record(z.string()).optional(),
      isDefault: z.boolean().default(false),
    })
  ),
  async (c) => {
    const data = c.req.valid('json');
    const db = getDb();

    const existing = await db.query.providers.findFirst({ where: eq(providers.name, data.name) });
    if (existing) throw new ValidationError('Provider with this name already exists');

    if (data.isDefault) {
      await db.update(providers).set({ isDefault: false }).where(eq(providers.isDefault, true));
    }

    const providerId = createId();
    await db.insert(providers).values({
      id: providerId,
      name: data.name,
      type: data.type,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey ? encrypt(data.apiKey) : null,
      chatModel: data.chatModel,
      embedModel: data.embedModel,
      rerankModel: data.rerankModel,
      customHeaders: data.customHeaders,
      isDefault: data.isDefault,
    });

    auditLog({
      userId: c.get('userId'),
      action: 'ai.provider.create',
      resourceType: 'provider',
      resourceId: providerId,
      metadata: { name: data.name, type: data.type },
    });

    return c.json({ success: true, data: { id: providerId } }, 201);
  }
);

providerRoutes.get('/:id', async (c) => {
  const db = getDb();
  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, c.req.param('id')),
  });
  if (!provider) throw new NotFoundError('Provider', c.req.param('id'));

  return c.json({
    success: true,
    data: { ...provider, apiKey: provider.apiKey ? '***' : null },
  });
});

providerRoutes.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100).optional(),
      baseUrl: z.string().url().optional(),
      apiKey: z.string().optional(),
      chatModel: z.string().optional(),
      embedModel: z.string().optional(),
      rerankModel: z.string().optional(),
      customHeaders: z.record(z.string()).optional(),
      isDefault: z.boolean().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const db = getDb();

    const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
    if (!provider) throw new NotFoundError('Provider', id);

    if (data.isDefault) {
      await db.update(providers).set({ isDefault: false }).where(eq(providers.isDefault, true));
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.baseUrl) updates.baseUrl = data.baseUrl;
    if (data.apiKey !== undefined) updates.apiKey = data.apiKey ? encrypt(data.apiKey) : null;
    if (data.chatModel) updates.chatModel = data.chatModel;
    if (data.embedModel) updates.embedModel = data.embedModel;
    if (data.rerankModel) updates.rerankModel = data.rerankModel;
    if (data.customHeaders) updates.customHeaders = data.customHeaders;
    if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

    await db.update(providers).set(updates).where(eq(providers.id, id));

    auditLog({
      userId: c.get('userId'),
      action: 'ai.provider.update',
      resourceType: 'provider',
      resourceId: id,
      metadata: data,
    });

    return c.json({ success: true });
  }
);

providerRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) throw new NotFoundError('Provider', id);

  const runningTasks = await db.$count(
    tasks,
    and(eq(tasks.providerId, id), eq(tasks.status, 'running'))
  );
  if (runningTasks > 0) throw new ValidationError('Cannot delete provider with running tasks');

  await db.delete(providers).where(eq(providers.id, id));

  auditLog({
    userId: c.get('userId'),
    action: 'ai.provider.delete',
    resourceType: 'provider',
    resourceId: id,
  });

  return c.json({ success: true });
});

providerRoutes.post('/:id/test', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) throw new NotFoundError('Provider', id);

  try {
    const apiKey = provider.apiKey ? decrypt(provider.apiKey) : undefined;
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
        'Content-Type': 'application/json',
        ...provider.customHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    await db
      .update(providers)
      .set({
        lastTestedAt: new Date(),
        lastTestResult: 'success',
        discoveredModels: data.data?.map((m: { id: string }) => m.id) || [],
      })
      .where(eq(providers.id, id));

    return c.json({
      success: true,
      data: { models: data.data?.map((m: { id: string }) => m.id) || [] },
    });
  } catch (error) {
    await db
      .update(providers)
      .set({
        lastTestedAt: new Date(),
        lastTestResult: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(providers.id, id));
    return c.json({
      success: false,
      error: {
        code: 'PROVIDER_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

providerRoutes.post('/:id/discover-models', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const provider = await db.query.providers.findFirst({ where: eq(providers.id, id) });
  if (!provider) throw new NotFoundError('Provider', id);

  try {
    const apiKey = provider.apiKey ? decrypt(provider.apiKey) : undefined;
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : '',
        'Content-Type': 'application/json',
        ...provider.customHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data?.map((m: { id: string }) => m.id) || [];

    await db
      .update(providers)
      .set({ discoveredModels: models, lastTestedAt: new Date(), lastTestResult: 'success' })
      .where(eq(providers.id, id));

    return c.json({ success: true, data: { models } });
  } catch (error) {
    await db
      .update(providers)
      .set({
        lastTestedAt: new Date(),
        lastTestResult: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(providers.id, id));
    return c.json({
      success: false,
      error: {
        code: 'MODEL_DISCOVERY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default providerRoutes;
