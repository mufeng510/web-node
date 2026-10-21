import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { type Options, type SimpleGit, simpleGit } from 'simple-git';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { gitCommits, gitConfigs } from '../../db/schema/git.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import type { Env } from '../../middleware/env.js';
import { decrypt } from '../../utils/crypto.js';
import { ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';
import { getLibraryRoot } from '../../utils/path.js';
import { checkLibraryAccess } from '../libraries/access.js';

const gitRoutes = new Hono<Env>();

gitRoutes.use('*', authMiddleware());

/**
 * 将 HTTPS remote URL 中嵌入凭据。
 * credentials 格式: "username:password" 或 "token"
 */
function urlWithAuth(remoteUrl: string, credentials: string): string {
  try {
    const url = new URL(remoteUrl);
    if (credentials.includes(':')) {
      const [user = '', pass = ''] = credentials.split(':');
      url.username = user;
      url.password = pass;
    } else {
      // 纯 token，用作用户名（GitHub/GitLab PAT 等）
      url.username = credentials;
    }
    return url.toString();
  } catch {
    return remoteUrl;
  }
}

/**
 * 解析 push/pull 所需的 remote 参数。若配置了 HTTPS 凭据，返回带凭据的 URL；
 * 否则返回原 remote 名（如 'origin'）。
 */
function resolveRemote(
  remote: string | undefined,
  authType: string | null,
  credentials: string | null,
  remoteUrl: string | null
): string {
  const r = remote || 'origin';
  if (authType === 'https' && credentials && remoteUrl) {
    try {
      const decrypted = decrypt(credentials);
      return urlWithAuth(remoteUrl, decrypted);
    } catch {
      return r;
    }
  }
  return r;
}

/**
 * 查询库的 Git 配置，并解密 credentials。
 */
async function getGitConfig(libraryId: string) {
  const db = getDb();
  const row = await db.query.gitConfigs.findFirst({
    where: eq(gitConfigs.libraryId, libraryId),
  });
  if (!row) return null;
  let credentials: string | null = null;
  if (row.credentials) {
    try {
      credentials = decrypt(row.credentials);
    } catch {
      credentials = null;
    }
  }
  return {
    remoteUrl: row.remoteUrl,
    branch: row.branch,
    authType: row.authType,
    credentials,
    autoBackup: row.autoBackup,
    autoBackupSchedule: row.autoBackupSchedule,
  };
}

async function getGit(
  libraryPath: string,
  authType: string | null = null,
  credentials: string | null = null
): Promise<SimpleGit> {
  const root = getLibraryRoot(libraryPath);
  const git = simpleGit(root);

  // SSH 模式下，为当前仓库配置 core.sshCommand（写入 .git/config，不污染全局环境）
  if (authType === 'ssh' && credentials) {
    try {
      const decrypted = decrypt(credentials);
      await git.raw([
        'config',
        'core.sshCommand',
        `ssh -i ${decrypted} -o StrictHostKeyChecking=accept-new`,
      ]);
    } catch {
      // 配置 sshCommand 失败不阻塞后续操作
    }
  }

  return git;
}

gitRoutes.get('/:libraryId/config', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

  const db = getDb();
  const row = await db.query.gitConfigs.findFirst({
    where: eq(gitConfigs.libraryId, libraryId),
  });

  // `enabled` 只存在于 libraries.gitConfig（JSON），其余字段在 git_configs 表
  const jsonConfig = (library.gitConfig ?? {}) as Record<string, unknown>;
  const enabled = typeof jsonConfig.enabled === 'boolean' ? jsonConfig.enabled : row != null;

  return c.json({
    success: true,
    data: {
      enabled,
      remoteUrl: row?.remoteUrl ?? (jsonConfig.remoteUrl as string) ?? '',
      branch: row?.branch ?? (jsonConfig.branch as string) ?? 'main',
      authType: row?.authType ?? (jsonConfig.authType as 'none' | 'https' | 'ssh') ?? 'none',
      // 凭据只回传“是否已配置”，绝不回传明文
      hasCredentials: row?.credentials != null && row.credentials.length > 0,
      autoBackup: row?.autoBackup ?? (jsonConfig.autoBackup as boolean) ?? true,
      autoBackupSchedule:
        row?.autoBackupSchedule ?? (jsonConfig.autoBackupSchedule as string) ?? '0 * * * *',
      lastBackupAt: row?.lastBackupAt ?? null,
    },
  });
});

gitRoutes.get('/:libraryId/status', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  const { library } = await checkLibraryAccess(userId, libraryId);
  const gitConfig = await getGitConfig(libraryId);
  const git = await getGit(
    library.path,
    gitConfig?.authType ?? null,
    gitConfig?.credentials ?? null
  );

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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    // simple-git 不识别 `limit` 字段，改用 `maxCount`；skip 通过 `--skip` 传递
    const logOptions = skip > 0 ? { maxCount: limit, '--skip': String(skip) } : { maxCount: limit };
    const log = await git.log(logOptions);
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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    if (filesToCommit?.length) {
      await git.add(filesToCommit);
    } else {
      await git.add('.');
    }

    const status = await git.status();
    if (status.files.length === 0) {
      throw new ValidationError('No changes to commit');
    }

    const commitOptions: Options = { '--no-verify': null };
    if (author) {
      commitOptions['--author'] = `${author.name} <${author.email}>`;
    }

    const commit = await git.commit(message, commitOptions);

    const db = getDb();
    await db.insert(gitCommits).values({
      id: createId(),
      libraryId,
      hash: commit.commit,
      shortHash: commit.commit.slice(0, 7),
      message,
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
      resourceId: commit.commit,
      metadata: { message, files: status.files.map((f) => f.path) },
    });

    return c.json({ success: true, data: { hash: commit.commit, message } });
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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    const resolvedRemote = resolveRemote(
      remote,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null,
      gitConfig?.remoteUrl ?? null
    );

    // SSH 模式：通过 core.sshCommand 已在 getGit 中配置；此处直接执行 push
    try {
      await git.push(resolvedRemote, branch, force ? ['--force'] : []);
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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    const status = await git.status();
    if (status.files.length > 0) {
      throw new ValidationError('Local changes exist. Commit or stash before pulling.');
    }

    const resolvedRemote = resolveRemote(
      remote,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null,
      gitConfig?.remoteUrl ?? null
    );

    try {
      await git.pull(resolvedRemote, branch, rebase ? ['--rebase'] : []);
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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    try {
      if (strategy === 'checkout') {
        await git.checkout(commitHash, paths);
      } else {
        for (const path of paths) {
          await git.raw(['revert', commitHash, '--', path]);
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
    const gitConfig = await getGitConfig(libraryId);
    const git = await getGit(
      library.path,
      gitConfig?.authType ?? null,
      gitConfig?.credentials ?? null
    );

    const log = await git.log({
      file: filePath,
      maxCount: limit,
    });
    return c.json({ success: true, data: { log } });
  }
);

export default gitRoutes;
