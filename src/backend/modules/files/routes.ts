import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getAbsolutePath, getLibraryRoot } from '../../utils/path.js';
import { getDb } from '../db/index.js';
import { files } from '../db/schema/files.js';
import { checkLibraryAccess } from '../libraries/access.js';
import { readLibraryConfig } from '../libraries/config.js';
import { auditLog } from '../middleware/audit.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { ConcurrencyError, NotFoundError, ValidationError } from '../utils/errors.js';
import { createId } from '../utils/id.js';

const fileRoutes = new Hono();

fileRoutes.use('*', authMiddleware());

fileRoutes.get('/:libraryId/tree', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const showHidden = c.req.query('hidden') === 'true';
  const showObsidian = c.req.query('obsidian') === 'true';
  const showGit = c.req.query('git') === 'true';
  const maxDepth = Number.parseInt(c.req.query('depth') || '10');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);

  const { scanLibraryTree } = await import('../libraries/scanner.js');
  const tree = await scanLibraryTree(library.path, {
    showHidden: showHidden || config?.visibility?.showHiddenFiles,
    showObsidian: showObsidian || config?.visibility?.showObsidianDir,
    showGit: showGit || config?.visibility?.showGitDir,
    maxDepth,
  });

  return c.json({ success: true, data: { tree } });
});

fileRoutes.get('/:libraryId/*', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const filePath = c.req.param('*') || '';

  const { library } = await checkLibraryAccess(userId, libraryId);
  const absolutePath = getAbsolutePath(library.path, filePath);

  try {
    const content = await readFile(absolutePath, 'utf-8');
    const stats = await stat(absolutePath);

    return c.json({
      success: true,
      data: {
        path: filePath,
        content,
        size: stats.size,
        mtime: stats.mtime,
        isDir: stats.isDirectory(),
        mimeType: getMimeType(filePath),
      },
    });
  } catch (_error) {
    throw new NotFoundError('File', filePath);
  }
});

fileRoutes.post(
  '/:libraryId/',
  zValidator(
    'json',
    z.object({
      path: z.string().min(1),
      content: z.string().optional(),
      isDir: z.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { path, content = '', isDir } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const config = await readLibraryConfig(library.path);
    if (config?.readOnly) throw new AuthorizationError('Library is read-only');

    const absolutePath = getAbsolutePath(library.path, path);
    const parentDir = dirname(absolutePath);

    await mkdir(parentDir, { recursive: true });

    if (isDir) {
      await mkdir(absolutePath, { recursive: true });
    } else {
      await writeFile(absolutePath, content, 'utf-8');
    }

    const stats = await stat(absolutePath);
    const db = getDb();
    const fileId = createId();
    await db.insert(files).values({
      id: fileId,
      libraryId,
      path,
      name: path.split('/').pop() || '',
      isDir,
      size: stats.size,
      mimeType: isDir ? undefined : getMimeType(path),
      mtime: stats.mtime,
    });

    auditLog({
      userId,
      libraryId,
      action: 'file.create',
      resourceType: 'file',
      resourceId: fileId,
      metadata: { path, isDir },
    });

    return c.json({ success: true, data: { id: fileId, path } }, 201);
  }
);

fileRoutes.patch(
  '/:libraryId/*',
  zValidator(
    'json',
    z.object({
      content: z.string().optional(),
      frontmatter: z.record(z.unknown()).optional(),
      expectedHash: z.string().optional(),
      expectedVersion: z.number().int().nonnegative().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const filePath = c.req.param('*') || '';
    const { content, expectedHash, expectedVersion } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const config = await readLibraryConfig(library.path);
    if (config?.readOnly) throw new AuthorizationError('Library is read-only');

    const absolutePath = getAbsolutePath(library.path, filePath);
    const db = getDb();

    const existing = await db.query.files.findFirst({
      where: and(eq(files.libraryId, libraryId), eq(files.path, filePath)),
    });
    if (!existing) throw new NotFoundError('File', filePath);

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new ConcurrencyError(expectedVersion, existing.version);
    }

    if (expectedHash) {
      const crypto = await import('node:crypto');
      const currentHash = crypto
        .createHash('sha256')
        .update(await readFile(absolutePath, 'utf-8'))
        .digest('hex');
      if (currentHash !== expectedHash) {
        throw new ConcurrencyError(0, 0);
      }
    }

    if (content !== undefined) {
      const tempPath = `${absolutePath}.tmp`;
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, absolutePath);
    }

    const stats = await stat(absolutePath);
    await db
      .update(files)
      .set({ size: stats.size, mtime: stats.mtime, version: { increment: 1 } })
      .where(eq(files.id, existing.id));

    auditLog({
      userId,
      libraryId,
      action: 'file.update',
      resourceType: 'file',
      resourceId: existing.id,
      metadata: { path: filePath },
    });

    return c.json({ success: true, data: { version: existing.version + 1 } });
  }
);

fileRoutes.post(
  '/:libraryId/move',
  zValidator(
    'json',
    z.object({
      moves: z
        .array(
          z.object({
            sourcePath: z.string().min(1),
            targetPath: z.string().min(1),
          })
        )
        .min(1)
        .max(100),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { moves } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const config = await readLibraryConfig(library.path);
    if (config?.readOnly) throw new AuthorizationError('Library is read-only');

    const db = getDb();
    const results: any[] = [];

    for (const { sourcePath, targetPath } of moves) {
      try {
        const sourceAbs = getAbsolutePath(library.path, sourcePath);
        const targetAbs = getAbsolutePath(library.path, targetPath);

        await mkdir(dirname(targetAbs), { recursive: true });
        await rename(sourceAbs, targetAbs);

        await db
          .update(files)
          .set({ path: targetPath, name: targetPath.split('/').pop() || '', updatedAt: new Date() })
          .where(and(eq(files.libraryId, libraryId), eq(files.path, sourcePath)));

        await db
          .update(files)
          .set({ path: targetPath, updatedAt: new Date() })
          .where(and(eq(files.libraryId, libraryId), eq(files.path, sourcePath)));

        results.push({ sourcePath, targetPath, success: true });
      } catch (error) {
        results.push({
          sourcePath,
          targetPath,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    auditLog({
      userId,
      libraryId,
      action: 'file.move',
      resourceType: 'file',
      metadata: { moves: results },
    });

    return c.json({ success: true, data: { results } });
  }
);

fileRoutes.post(
  '/:libraryId/rename',
  zValidator(
    'json',
    z.object({
      renames: z
        .array(
          z.object({
            path: z.string().min(1),
            newName: z.string().min(1).max(255),
          })
        )
        .min(1)
        .max(100),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { renames } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const config = await readLibraryConfig(library.path);
    if (config?.readOnly) throw new AuthorizationError('Library is read-only');

    const db = getDb();
    const results: any[] = [];

    for (const { path, newName } of renames) {
      try {
        const dir = dirname(path);
        const newPath = dir === '.' ? newName : join(dir, newName);
        const sourceAbs = getAbsolutePath(library.path, path);
        const targetAbs = getAbsolutePath(library.path, newPath);

        await rename(sourceAbs, targetAbs);

        await db
          .update(files)
          .set({ path: newPath, name: newName, updatedAt: new Date() })
          .where(and(eq(files.libraryId, libraryId), eq(files.path, path)));

        results.push({ path, newPath, success: true });
      } catch (error) {
        results.push({
          path,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    auditLog({
      userId,
      libraryId,
      action: 'file.rename',
      resourceType: 'file',
      metadata: { renames: results },
    });

    return c.json({ success: true, data: { results } });
  }
);

fileRoutes.delete('/:libraryId/*', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const filePath = c.req.param('*') || '';

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);
  if (config?.readOnly) throw new AuthorizationError('Library is read-only');

  const db = getDb();
  const existing = await db.query.files.findFirst({
    where: and(eq(files.libraryId, libraryId), eq(files.path, filePath)),
  });
  if (!existing) throw new NotFoundError('File', filePath);

  const trashPath = join(
    getLibraryRoot(library.path),
    '.webnote',
    'trash',
    `${Date.now()}_${filePath.replace(/\//g, '_')}`
  );
  await mkdir(dirname(trashPath), { recursive: true });
  await rename(getAbsolutePath(library.path, filePath), trashPath);

  await db
    .update(files)
    .set({ path: `.webnote/trash/${relative(library.path, trashPath)}`, updatedAt: new Date() })
    .where(eq(files.id, existing.id));

  auditLog({
    userId,
    libraryId,
    action: 'file.delete',
    resourceType: 'file',
    resourceId: existing.id,
    metadata: { path: filePath, trashPath },
  });

  return c.json({ success: true });
});

fileRoutes.post('/:libraryId/upload', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const body = await c.req.parseBody();
  const file = body.file as File;
  const targetDir = (body.targetDir as string) || 'attachments';
  const _overwrite = body.overwrite === 'true';

  if (!file) throw new ValidationError('No file provided');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const config = await readLibraryConfig(library.path);
  if (config?.readOnly) throw new AuthorizationError('Library is read-only');

  const targetAbs = getAbsolutePath(library.path, targetDir);
  await mkdir(targetAbs, { recursive: true });

  const fileName = file.name;
  const destPath = join(targetAbs, fileName);
  const relativeDest = join(targetDir, fileName);

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(destPath, Buffer.from(arrayBuffer));

  const stats = await stat(destPath);
  const db = getDb();
  const fileId = createId();
  await db.insert(files).values({
    id: fileId,
    libraryId,
    path: relativeDest,
    name: fileName,
    isDir: false,
    size: stats.size,
    mimeType: file.type || getMimeType(fileName),
    mtime: stats.mtime,
  });

  auditLog({
    userId,
    libraryId,
    action: 'file.upload',
    resourceType: 'file',
    resourceId: fileId,
    metadata: { path: relativeDest, size: stats.size },
  });

  return c.json({ success: true, data: { id: fileId, path: relativeDest } });
});

fileRoutes.get('/:libraryId/references', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const filePath = c.req.query('path');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const db = getDb();

  if (!filePath) {
    const allFiles = await db.query.files.findMany({ where: eq(files.libraryId, libraryId) });
    const references = await analyzeReferences(library.path, allFiles);
    return c.json({ success: true, data: { references } });
  }

  const targetFile = await db.query.files.findFirst({
    where: and(eq(files.libraryId, libraryId), eq(files.path, filePath)),
  });
  if (!targetFile) throw new NotFoundError('File', filePath);

  const allFiles = await db.query.files.findMany({ where: eq(files.libraryId, libraryId) });
  const references = await findReferencesToFile(library.path, filePath, allFiles);

  return c.json({ success: true, data: { references } });
});

async function analyzeReferences(_libraryPath: string, _allFiles: any[]) {
  return [];
}

async function findReferencesToFile(_libraryPath: string, _targetPath: string, _allFiles: any[]) {
  return [];
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export default fileRoutes;
