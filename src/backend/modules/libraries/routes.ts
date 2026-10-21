import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zValidator } from '@hono/zod-validator';
import { and, eq, notInArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { aiIndexes } from '../../db/schema/ai_index.js';
import { files } from '../../db/schema/files.js';
import { gitConfigs } from '../../db/schema/git.js';
import { type Library, libraries } from '../../db/schema/libraries.js';
import { libraryMembers } from '../../db/schema/libraries.js';
import { users } from '../../db/schema/users.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import type { Env } from '../../middleware/env.js';
import { encrypt } from '../../utils/crypto.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';
import { getLibraryRoot } from '../../utils/path.js';
import { checkLibraryAccess, getAccessibleLibraries } from './access.js';
import type { LibraryConfig } from './config.js';
import {
  getDefaultConfig,
  initializeLibraryConfig,
  readLibraryConfig,
  writeLibraryConfig,
} from './config.js';
import { type TreeNode, scanLibraryTree } from './scanner.js';
import { startLibraryWatcher, stopLibraryWatcher } from './watcher.js';

/**
 * 将 git 配置中的敏感 credentials 加密后再持久化。
 * `previous` 为库中已存的配置：未提供 credentials 时沿用旧值，避免误清空。
 */
function encryptGitConfig(gitConfig: any, previous?: any): any {
  if (!gitConfig || typeof gitConfig !== 'object') return gitConfig;
  const merged = { ...(previous ?? {}), ...gitConfig };
  if (gitConfig.credentials === undefined && previous?.credentials) {
    merged.credentials = previous.credentials;
  }
  return {
    ...merged,
    credentials: merged.credentials ? encrypt(merged.credentials) : merged.credentials,
  };
}

const libraryRoutes = new Hono<Env>();

libraryRoutes.use('*', authMiddleware());

libraryRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const libs: Library[] = await getAccessibleLibraries(userId, userRole);

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
          providerId: z.string().min(1).optional(),
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
      gitConfig: data.git ? encryptGitConfig(data.git) : null,
      aiIndexConfig: data.aiIndex,
    });

    // Preserve existing .webnote/config.json if present; only initialize if missing
    const existingConfig = await readLibraryConfig(fullPath);
    if (!existingConfig) {
      await initializeLibraryConfig(fullPath, data.name, userId);
      const created = await readLibraryConfig(fullPath);
      if (created) {
        if (data.attachments) created.attachments = { ...created.attachments, ...data.attachments };
        if (data.visibility) created.visibility = { ...created.visibility, ...data.visibility };
        if (data.readOnly !== undefined) created.readOnly = data.readOnly;
        await writeLibraryConfig(fullPath, created);
      }
    } else if (existingConfig.name !== data.name) {
      // Optionally update name in existing config
      existingConfig.name = data.name;
      await writeLibraryConfig(fullPath, existingConfig);
    }

    if (data.git?.enabled) {
      await db.insert(gitConfigs).values({
        id: createId(),
        libraryId,
        remoteUrl: data.git.remoteUrl,
        branch: data.git.branch,
        authType: data.git.authType,
        credentials: data.git.credentials ? encrypt(data.git.credentials) : null,
        autoBackup: data.git.autoBackup,
        autoBackupSchedule: data.git.autoBackupSchedule,
      });
    }

    if (data.aiIndex?.enabled) {
      await db.insert(aiIndexes).values({
        id: createId(),
        libraryId,
        providerId: data.aiIndex.providerId,
        // `ai_indexes.embed_model` is NOT NULL; same default as the index rebuild route.
        embedModel: data.aiIndex.embedModel || 'text-embedding-3-small',
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

libraryRoutes.get(
  '/discover',
  zValidator(
    'query',
    z.object({
      path: z.string().optional().default(''),
    })
  ),
  async (c) => {
    const { path: relPath } = c.req.valid('query');
    const db = getDb();

    const resolvedPath = getLibraryRoot(relPath);
    const env = getEnv();
    const dataRoot = env.DATA_ROOT;

    const currentPath = relPath.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

    let parentPath: string | null = null;
    if (currentPath) {
      const parts = currentPath.split('/');
      if (parts.length > 1) {
        parentPath = parts.slice(0, -1).join('/');
      } else {
        parentPath = '';
      }
    }

    const allLibraries = await db.select().from(libraries);
    const registeredByResolved = new Map(allLibraries.map((l) => [resolve(l.path), l.id] as const));

    let entries: string[] = [];
    try {
      entries = await readdir(resolvedPath);
    } catch {
      entries = [];
    }

    const directories: {
      name: string;
      path: string;
      registered: boolean;
      libraryId: string | null;
    }[] = [];
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;

      const entryAbsPath = join(resolvedPath, entry);
      let isDir = false;

      try {
        const stats = await stat(entryAbsPath);
        isDir = stats.isDirectory();
      } catch {
        continue;
      }

      if (!isDir) continue;

      const entryRelPath = currentPath ? `${currentPath}/${entry}` : entry;
      const libraryId = registeredByResolved.get(resolve(entryAbsPath)) ?? null;

      directories.push({
        name: entry,
        path: entryRelPath,
        registered: libraryId !== null,
        libraryId,
      });
    }

    directories.sort((a, b) => a.name.localeCompare(b.name));

    return c.json({
      success: true,
      data: {
        currentPath,
        parentPath,
        currentRegistered: registeredByResolved.has(resolvedPath),
        directories,
      },
    });
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
          providerId: z.string().min(1).optional(),
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
    if (data.git) updates.gitConfig = encryptGitConfig(data.git, library.gitConfig);
    if (data.aiIndex) updates.aiIndexConfig = data.aiIndex;
    if (data.attachments || data.visibility || data.readOnly !== undefined) {
      const config: LibraryConfig = (await readLibraryConfig(library.path)) ?? getDefaultConfig();
      if (data.attachments) config.attachments = { ...config.attachments, ...data.attachments };
      if (data.visibility) config.visibility = { ...config.visibility, ...data.visibility };
      if (data.readOnly !== undefined) config.readOnly = data.readOnly;
      await writeLibraryConfig(library.path, config);
      updates.config = config;
    }

    await db.update(libraries).set(updates).where(eq(libraries.id, libraryId));

    // Upsert gitConfigs 表（同步 libraries.gitConfig 的结构化副本）
    if (data.git) {
      const existingGitConfig = await db.query.gitConfigs.findFirst({
        where: eq(gitConfigs.libraryId, libraryId),
      });
      const gitValues: Record<string, unknown> = {
        remoteUrl: data.git.remoteUrl ?? existingGitConfig?.remoteUrl ?? '',
        branch: data.git.branch ?? existingGitConfig?.branch ?? 'main',
        authType: data.git.authType ?? existingGitConfig?.authType ?? 'none',
        autoBackup: data.git.autoBackup ?? existingGitConfig?.autoBackup ?? true,
        autoBackupSchedule:
          data.git.autoBackupSchedule ?? existingGitConfig?.autoBackupSchedule ?? '0 * * * *',
      };
      if (data.git.credentials !== undefined) {
        gitValues.credentials = data.git.credentials ? encrypt(data.git.credentials) : null;
      } else if (existingGitConfig) {
        gitValues.credentials = existingGitConfig.credentials;
      }
      if (existingGitConfig) {
        await db.update(gitConfigs).set(gitValues).where(eq(gitConfigs.libraryId, libraryId));
      } else {
        await db.insert(gitConfigs).values({
          id: createId(),
          libraryId,
          ...gitValues,
        });
      }
    }

    auditLog({
      userId,
      action: 'library.update',
      resourceType: 'library',
      resourceId: libraryId,
      // 审计日志不能落明文凭据
      metadata: data.git
        ? { ...data, git: { ...data.git, credentials: data.git.credentials ? '***' : undefined } }
        : data,
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

/** Depth-first, parents before children, so a parent id is always known first. */
function flattenTree(
  nodes: TreeNode[],
  parentPath: string | null,
  out: { node: TreeNode; parentPath: string | null }[] = []
) {
  for (const node of nodes) {
    out.push({ node, parentPath });
    if (node.children) flattenTree(node.children, node.relativePath, out);
  }
  return out;
}

/**
 * Mirrors the scanned tree into the `files` table.
 *
 * The watcher starts with `ignoreInitial: true`, so without this a library's
 * existing files never reach the table and everything reading it — backlinks,
 * the editor's save path, reference analysis — sees an empty library.
 */
async function indexLibrary(db: ReturnType<typeof getDb>, libraryId: string, tree: TreeNode[]) {
  const entries = flattenTree(tree, null);
  const idByPath = new Map<string, string>();

  for (const { node, parentPath } of entries) {
    const row = {
      libraryId,
      path: node.relativePath,
      name: node.name,
      isDir: node.isDir,
      size: node.size,
      mimeType: node.mimeType ?? null,
      mtime: node.mtime,
      parentId: parentPath ? (idByPath.get(parentPath) ?? null) : null,
    };

    const [upserted] = await db
      .insert(files)
      .values(row)
      .onConflictDoUpdate({
        target: [files.libraryId, files.path],
        set: {
          name: row.name,
          isDir: row.isDir,
          size: row.size,
          mimeType: row.mimeType,
          mtime: row.mtime,
          parentId: row.parentId,
          updatedAt: new Date(),
        },
      })
      .returning({ id: files.id });

    if (upserted) idByPath.set(node.relativePath, upserted.id);
  }

  // Rows for files deleted on disk would otherwise linger and surface as
  // backlinks to notes that no longer exist.
  const paths = entries.map(({ node }) => node.relativePath);
  await db
    .delete(files)
    .where(
      paths.length === 0
        ? eq(files.libraryId, libraryId)
        : and(eq(files.libraryId, libraryId), notInArray(files.path, paths))
    );
}

libraryRoutes.post('/:id/scan', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('id');
  const db = getDb();

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);

  const tree = await scanLibraryTree(library.path, {
    showHidden: config?.visibility?.showHiddenFiles,
    showObsidian: config?.visibility?.showObsidianDir,
    showGit: config?.visibility?.showGitDir,
  });

  await indexLibrary(db, libraryId, tree);

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
  const dirCount = await db.$count(
    files,
    and(eq(files.libraryId, libraryId), eq(files.isDir, true))
  );

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
      userId: z.string().min(1),
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
      newOwnerId: z.string().min(1),
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
