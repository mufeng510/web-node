import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { type SimpleGit, simpleGit } from 'simple-git';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { gitCommits } from '../../db/schema/git.js';
import { checkLibraryAccess } from '../../libraries/access.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';
import { getLibraryRoot } from '../../utils/path.js';

const gitRoutes = new Hono();

gitRoutes.use('*', authMiddleware());

async function getGit(libraryPath: string): Promise<SimpleGit> {
  const root = getLibraryRoot(libraryPath);
  return simpleGit(root);
}

gitRoutes.get('/:libraryId/status', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const git = await getGit(library.path);

  const status = await git.status();
  return c.json({ success: true, data: { status } });
});

gitRoutes.get(
  '/:libraryId/log',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(100).default(20),
      skip: z.coerce.number().int().nonnegative().default(0),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { limit, skip } = c.req.valid('query');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const git = await getGit(library.path);

    const log = await git.log({ limit, skip });
    return c.json({ success: true, data: { log } });
  }
);

gitRoutes.get(
  '/:libraryId/diff',
  zValidator(
    'query',
    z.object({
      file: z.string().optional(),
      staged: z.coerce.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { file, staged } = c.req.valid('query');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const git = await getGit(library.path);

    const diff = file
      ? await git.diff([staged ? '--staged' : '', file].filter(Boolean))
      : await git.diff(staged ? ['--staged'] : []);

    return c.json({ success: true, data: { diff } });
  }
);

gitRoutes.post(
  '/:libraryId/commit',
  zValidator(
    'json',
    z.object({
      message: z.string().min(1).max(1000),
      author: z
        .object({
          name: z.string().min(1),
          email: z.string().email(),
        })
        .optional(),
      files: z.array(z.string()).optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { message, author, files: filesToCommit } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');
    const git = await getGit(library.path);

    if (filesToCommit?.length) {
      await git.add(filesToCommit);
    } else {
      await git.add('.');
    }

    const status = await git.status();
    if (status.files.length === 0) {
      throw new ValidationError('No changes to commit');
    }

    const commitOptions: Record<string, unknown> = { '--no-verify': true };
    if (author) {
      commitOptions.author = `${author.name} <${author.email}>`;
    }

    const commit = await git.commit(message, commitOptions);

    const db = getDb();
    await db.insert(gitCommits).values({
      id: createId(),
      libraryId,
      hash: commit.hash,
      shortHash: commit.hash.slice(0, 7),
      message: commit.summary,
      authorName: author?.name || 'Web Note',
      authorEmail: author?.email || 'webnote@local',
      authorDate: new Date(),
      files: status.files.map((f) => f.path),
    });

    auditLog({
      userId,
      libraryId,
      action: 'git.commit',
      resourceType: 'git',
      resourceId: commit.hash,
      metadata: { message, files: status.files.map((f) => f.path) },
    });

    return c.json({ success: true, data: { hash: commit.hash, message: commit.summary } });
  }
);

gitRoutes.post(
  '/:libraryId/push',
  zValidator(
    'json',
    z.object({
      remote: z.string().default('origin'),
      branch: z.string().optional(),
      force: z.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { remote, branch, force } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');
    const git = await getGit(library.path);

    try {
      await git.push(remote, branch, force ? ['--force'] : []);
    } catch (error) {
      throw new ValidationError(
        `Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    auditLog({
      userId,
      libraryId,
      action: 'git.push',
      resourceType: 'git',
      metadata: { remote, branch, force },
    });

    return c.json({ success: true });
  }
);

gitRoutes.post(
  '/:libraryId/pull',
  zValidator(
    'json',
    z.object({
      remote: z.string().default('origin'),
      branch: z.string().optional(),
      rebase: z.boolean().default(false),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { remote, branch, rebase } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');
    const git = await getGit(library.path);

    const status = await git.status();
    if (status.files.length > 0) {
      throw new ValidationError('Local changes exist. Commit or stash before pulling.');
    }

    try {
      await git.pull(remote, branch, rebase ? ['--rebase'] : []);
    } catch (error) {
      throw new ValidationError(
        `Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    auditLog({
      userId,
      libraryId,
      action: 'git.pull',
      resourceType: 'git',
      metadata: { remote, branch, rebase },
    });

    return c.json({ success: true });
  }
);

gitRoutes.post(
  '/:libraryId/restore',
  zValidator(
    'json',
    z.object({
      commitHash: z.string().min(1),
      paths: z.array(z.string()).min(1),
      strategy: z.enum(['checkout', 'revert']).default('checkout'),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { commitHash, paths, strategy } = c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');
    const git = await getGit(library.path);

    try {
      if (strategy === 'checkout') {
        await git.checkout(commitHash, paths);
      } else {
        for (const path of paths) {
          await git.revert([commitHash, '--', path]);
        }
      }
    } catch (error) {
      throw new ValidationError(
        `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    auditLog({
      userId,
      libraryId,
      action: 'git.restore',
      resourceType: 'git',
      resourceId: commitHash,
      metadata: { paths, strategy },
    });

    return c.json({ success: true });
  }
);

gitRoutes.get(
  '/:libraryId/history/:path',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(50).default(20),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const filePath = c.req.param('path');
    const { limit } = c.req.valid('query');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const git = await getGit(library.path);

    const log = await git.log({ file: filePath, limit });
    return c.json({ success: true, data: { log } });
  }
);

export default gitRoutes;
