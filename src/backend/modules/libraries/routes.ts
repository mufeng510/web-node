import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { getDb } from '../db/index.js';
import { libraries } from '../db/schema/libraries.js';
import { libraryMembers } from '../db/schema/libraries.js';
import { auditLog } from '../middleware/audit.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { createId } from '../utils/id.js';
import { checkLibraryAccess, getAccessibleLibraries } from './access.js';
import { initializeLibraryConfig, readLibraryConfig, writeLibraryConfig } from './config.js';
import { scanLibraryTree } from './scanner.js';
import { startLibraryWatcher, stopLibraryWatcher } from './watcher.js';

const libraryRoutes = new Hono();

libraryRoutes.use('*', authMiddleware());

libraryRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const libs = await getAccessibleLibraries(userId, userRole);

  return c.json({
    success: true,
    data: libs.map((l) => ({
      id: l.id,
      name: l.name,
      path: l.path,
      ownerId: l.ownerId,
      config: l.config,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
});

libraryRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(255),
      path: z.string().min(1),
      git: z
        .object({
          enabled: z.boolean().default(false),
          remoteUrl: z.string().url().optional().or(z.literal('')),
          branch: z.string().default('main'),
          authType: z.enum(['none', 'https', 'ssh']).default('none'),
          credentials: z.string().optional(),
          autoBackup: z.boolean().default(true),
          autoBackupSchedule: z.string().default('0 * * * *'),
        })
        .optional(),
      aiIndex: z
        .object({
          enabled: z.boolean().default(true),
          providerId: z.string().uuid().optional(),
          embedModel: z.string().optional(),
          chunkSize: z.number().int().positive().default(512),
          chunkOverlap: z.number().int().nonnegative().default(50),
          excludePatterns: z.array(z.string()).default(['.obsidian/**', '.git/**', '.webnote/**']),
        })
        .optional(),
      attachments: z
        .object({
          defaultDir: z.string().default('attachments'),
          allowedTypes: z
            .array(z.string())
            .default(['image/*', 'application/pdf', 'application/zip', 'audio/*', 'video/*']),
        })
        .optional(),
      visibility: z
        .object({
          showHiddenFiles: z.boolean().default(false),
          showObsidianDir: z.boolean().default(false),
          showGitDir: z.boolean().default(false),
        })
        .optional(),
      readOnly: z.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const data = c.req.valid('json');
    const db = getDb();
    const env = getEnv();

    const fullPath = `${env.DATA_ROOT}/${data.path}`.replace(/\/+/g, '/');

    const existing = await db.query.libraries.findFirst({
      where: eq(libraries.path, fullPath),
    });
    if (existing) throw new ValidationError('Library already registered at this path');

    const libraryId = createId();
    await db.insert(libraries).values({
      id: libraryId,
      name: data.name,
      path: fullPath,
      ownerId: userId,
      config: {},
      gitConfig: data.git,
      aiIndexConfig: data.aiIndex,
    });

    await initializeLibraryConfig(fullPath, data.name, userId);

    if (data.git?.enabled && data.git.remoteUrl) {
      await db.insert(gitConfigs).values({
        id: createId(),
        libraryId,
        remoteUrl: data.git.remoteUrl,
        branch: data.git.branch,
        authType: data.git.authType,
        credentials: data.git.credentials,
        autoBackup: data.git.autoBackup,
        autoBackupSchedule: data.git.autoBackupSchedule,
      });
    }

    if (data.aiIndex?.enabled) {
      await db.insert(aiIndexes).values({
        id: createId(),
        libraryId,
        providerId: data.aiIndex.providerId,
        embedModel: data.aiIndex.embedModel,
        status: 'idle',
      });
    }

    startLibraryWatcher(libraryId, fullPath);

    auditLog({
      userId,
      action: 'library.create',
      resourceType: 'library',
      resourceId: libraryId,
      metadata: { name: data.name, path: fullPath },
    });

    return c.json({ success: true, data: { id: libraryId, name: data.name, path: fullPath } }, 201);
  }
);

libraryRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const { library } = await checkLibraryAccess(userId, c.req.param('id'));

  return c.json({
    success: true,
    data: {
      id: library.id,
      name: library.name,
      path: library.path,
      ownerId: library.ownerId,
      config: library.config,
    },
  });
});

libraryRoutes.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(255).optional(),
      git: z
        .object({
          enabled: z.boolean().optional(),
          remoteUrl: z.string().url().optional().or(z.literal('')),
          branch: z.string().optional(),
          authType: z.enum(['none', 'https', 'ssh']).optional(),
          credentials: z.string().optional(),
          autoBackup: z.boolean().optional(),
          autoBackupSchedule: z.string().optional(),
        })
        .optional(),
      aiIndex: z
        .object({
          enabled: z.boolean().optional(),
          providerId: z.string().uuid().optional(),
          embedModel: z.string().optional(),
          chunkSize: z.number().int().positive().optional(),
          chunkOverlap: z.number().int().nonnegative().optional(),
          excludePatterns: z.array(z.string()).optional(),
        })
        .optional(),
      attachments: z
        .object({
          defaultDir: z.string().optional(),
          allowedTypes: z.array(z.string()).optional(),
        })
        .optional(),
      visibility: z
        .object({
          showHiddenFiles: z.boolean().optional(),
          showObsidianDir: z.boolean().optional(),
          showGitDir: z.boolean().optional(),
        })
        .optional(),
      readOnly: z.boolean().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('id');
    const data = c.req.valid('json');
    const db = getDb();

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

    const updates: any = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.git) updates.gitConfig = data.git;
    if (data.aiIndex) updates.aiIndexConfig = data.aiIndex;
    if (data.attachments || data.visibility || data.readOnly !== undefined) {
      const config = (await readLibraryConfig(library.path)) || {};
      if (data.attachments) config.attachments = { ...config.attachments, ...data.attachments };
      if (data.visibility) config.visibility = { ...config.visibility, ...data.visibility };
      if (data.readOnly !== undefined) config.readOnly = data.readOnly;
      await writeLibraryConfig(library.path, config);
      updates.config = config;
    }

    await db.update(libraries).set(updates).where(eq(libraries.id, libraryId));

    auditLog({
      userId,
      action: 'library.update',
      resourceType: 'library',
      resourceId: libraryId,
      metadata: data,
    });

    return c.json({ success: true });
  }
);

libraryRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const db = getDb();

  const { library } = await checkLibraryAccess(userId, libraryId, 'owner');

  await db.delete(libraries).where(eq(libraries.id, libraryId));
  stopLibraryWatcher(libraryId);

  auditLog({
    userId,
    action: 'library.delete',
    resourceType: 'library',
    resourceId: libraryId,
  });

  return c.json({ success: true });
});

libraryRoutes.post('/:id/scan', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const _db = getDb();

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);

  const tree = await scanLibraryTree(library.path, {
    showHidden: config?.visibility?.showHiddenFiles,
    showObsidian: config?.visibility?.showObsidianDir,
    showGit: config?.visibility?.showGitDir,
  });

  return c.json({ success: true, data: { tree, totalFiles: countFiles(tree) } });
});

libraryRoutes.get('/:id/tree', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const showHidden = c.req.query('hidden') === 'true';
  const showObsidian = c.req.query('obsidian') === 'true';
  const showGit = c.req.query('git') === 'true';
  const maxDepth = Number.parseInt(c.req.query('depth') || '10');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);

  const tree = await scanLibraryTree(library.path, {
    showHidden: showHidden || config?.visibility?.showHiddenFiles,
    showObsidian: showObsidian || config?.visibility?.showObsidianDir,
    showGit: showGit || config?.visibility?.showGitDir,
    maxDepth,
  });

  return c.json({ success: true, data: { tree } });
});

libraryRoutes.get('/:id/stats', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const db = getDb();

  const { library } = await checkLibraryAccess(userId, libraryId);

  const fileCount = await db.$count(files, eq(files.libraryId, libraryId));
  const dirCount = await db
    .$count(files, eq(files.libraryId, libraryId))
    .where(eq(files.isDir, true));

  return c.json({
    success: true,
    data: { fileCount, dirCount, totalCount: fileCount + dirCount },
  });
});

libraryRoutes.post(
  '/:id/share',
  zValidator(
    'json',
    z.object({
      userId: z.string().uuid(),
      permission: z.enum(['read', 'write', 'admin']).default('write'),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('id');
    const { userId: targetUserId, permission } = c.req.valid('json');
    const db = getDb();

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

    const targetUser = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });
    if (!targetUser) throw new NotFoundError('User', targetUserId);

    await db
      .insert(libraryMembers)
      .values({
        id: createId(),
        libraryId,
        userId: targetUserId,
        role: permission === 'admin' ? 'admin' : 'member',
      })
      .onConflictDoUpdate({
        target: [libraryMembers.libraryId, libraryMembers.userId],
        set: { role: permission === 'admin' ? 'admin' : 'member' },
      });

    auditLog({
      userId,
      action: 'library.share',
      resourceType: 'library',
      resourceId: libraryId,
      metadata: { targetUserId, permission },
    });

    return c.json({ success: true });
  }
);

libraryRoutes.delete('/:id/share/:userId', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const targetUserId = c.req.param('userId');
  const db = getDb();

  await checkLibraryAccess(userId, libraryId, 'admin');

  await db
    .delete(libraryMembers)
    .where(and(eq(libraryMembers.libraryId, libraryId), eq(libraryMembers.userId, targetUserId)));

  auditLog({
    userId,
    action: 'library.unshare',
    resourceType: 'library',
    resourceId: libraryId,
    metadata: { targetUserId },
  });

  return c.json({ success: true });
});

libraryRoutes.post(
  '/:id/transfer-ownership',
  zValidator(
    'json',
    z.object({
      newOwnerId: z.string().uuid(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('id');
    const { newOwnerId } = c.req.valid('json');
    const db = getDb();

    const { library } = await checkLibraryAccess(userId, libraryId, 'owner');

    if (library.ownerId === newOwnerId) throw new ValidationError('User is already the owner');

    const newOwner = await db.query.users.findFirst({ where: eq(users.id, newOwnerId) });
    if (!newOwner) throw new NotFoundError('User', newOwnerId);

    await db.update(libraries).set({ ownerId: newOwnerId }).where(eq(libraries.id, libraryId));
    await db
      .insert(libraryMembers)
      .values({
        id: createId(),
        libraryId,
        userId,
        role: 'member',
      })
      .onConflictDoUpdate({
        target: [libraryMembers.libraryId, libraryMembers.userId],
        set: { role: 'member' },
      });

    const config = await readLibraryConfig(library.path);
    if (config) {
      config.ownerId = newOwnerId;
      await writeLibraryConfig(library.path, config);
    }

    auditLog({
      userId,
      action: 'library.transfer',
      resourceType: 'library',
      resourceId: libraryId,
      metadata: { newOwnerId },
    });

    return c.json({ success: true });
  }
);

function countFiles(nodes: any[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

export default libraryRoutes;
