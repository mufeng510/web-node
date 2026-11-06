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
import {
  type RepoConfigWarning,
  buildAuthenticatedRemote,
  inspectRepositoryConfig,
  isPrivateKeyPath,
  safeGitEnv,
  sanitizeGitError,
} from './remote.js';

const gitRoutes = new Hono<Env>();

gitRoutes.use('*', authMiddleware());

/**
 * 解析 push/pull 所需的 remote 参数。
 *
 * - 配置了 HTTPS 远端 + 凭据：返回带凭据的 URL
 * - 配置了远端但没有凭据：仍然返回**配置的 URL**，而不是 `origin`。
 *   导入既有仓库时，仓库自带的 origin 可能指向别处（甚至 fetch/push 不同），
 *   用它推送会推到用户没预期的位置。
 * - 没有配置远端：保持 `origin`（纯本地仓库/由仓库自身配置决定）。
 *
 * `credentials` 必须是**明文**（getGitConfig 已解密），不要再 decrypt。
 */
function resolveRemote(
  remote: string | undefined,
  authType: string | null,
  credentials: string | null,
  remoteUrl: string | null
): string {
  if (remoteUrl) {
    if (authType === 'https' && credentials) {
      try {
        return buildAuthenticatedRemote(remoteUrl, credentials);
      } catch {
        return remoteUrl;
      }
    }
    return remoteUrl;
  }
  return remote || 'origin';
}

/**
 * 查询库的 Git 配置，并解密 credentials。
 * 返回的 credentials 为明文（解密失败则为 null）——调用方不得再次 decrypt。
 *
 * `credentialsError` 用来区分"从未配置"和"配置了但解不开"：后者多半是
 * MASTER_ENCRYPTION_KEY 与写入时不一致，若当成"没有凭据"处理，git 会退化成
 * 匿名访问，界面只看到 "could not read Username"，完全查不出真实原因。
 */
async function getGitConfig(libraryId: string) {
  const db = getDb();
  const row = await db.query.gitConfigs.findFirst({
    where: eq(gitConfigs.libraryId, libraryId),
  });
  if (!row) return null;
  let credentials: string | null = null;
  let credentialsError: string | null = null;
  if (row.credentials) {
    try {
      credentials = decrypt(row.credentials);
    } catch (error) {
      credentials = null;
      credentialsError = error instanceof Error ? error.message : 'Unknown decryption error';
      console.error(
        `[Git] Failed to decrypt credentials for library ${libraryId}: ${credentialsError}`
      );
    }
  }
  return {
    remoteUrl: row.remoteUrl,
    branch: row.branch,
    authType: row.authType,
    credentials,
    credentialsError,
    autoBackup: row.autoBackup,
    autoBackupSchedule: row.autoBackupSchedule,
  };
}

const CREDENTIAL_DECRYPT_HINT =
  'Stored credentials could not be decrypted (MASTER_ENCRYPTION_KEY may have changed). Re-enter the credentials and save again.';

/** 需要凭据却拿不到的请求，直接把根因说清楚，而不是让 git 报匿名访问失败 */
function assertCredentialsUsable(
  gitConfig: {
    authType: string | null;
    credentials: string | null;
    credentialsError: string | null;
  } | null,
  requireCredentials: boolean
) {
  if (gitConfig?.credentialsError) {
    throw new ValidationError(CREDENTIAL_DECRYPT_HINT);
  }
  if (requireCredentials && !gitConfig?.credentials) {
    throw new ValidationError(
      'No credentials stored for this authentication type. Enter credentials and save the Git configuration first.'
    );
  }
}

/**
 * 远端协议与认证方式不一致时，git 会给出很难懂的报错（HTTPS 配置 + ssh 地址，
 * 或 SSH 配置 + https 地址）。这里提前拦下来，告诉用户该改哪一边。
 */
function assertAuthTypeMatchesRemote(
  remote: string,
  authType: string | null,
  credentials: string | null
) {
  const isHttp = /^https?:\/\//i.test(remote);
  const isSsh = /^(ssh:\/\/|[^/\s]+@[^/\s]+:)/i.test(remote);
  if (!isHttp && !isSsh) return;

  if (authType === 'ssh' && isHttp) {
    if (credentials && isPrivateKeyPath(credentials)) {
      throw new ValidationError(
        'Remote URL is an HTTPS address but authentication is set to SSH. Use an SSH remote (git@host:owner/repo.git) or switch authentication to HTTPS.'
      );
    }
    return;
  }
  if (authType === 'https' && isSsh) {
    throw new ValidationError(
      'Remote URL is an SSH address but authentication is set to HTTPS. Use an HTTPS remote (https://host/owner/repo.git) or switch authentication to SSH.'
    );
  }
}

/**
 * `credentials` 为明文（见 getGitConfig）。SSH 模式把私钥路径写进
 * GIT_SSH_COMMAND 传给 git 子进程，不写进仓库的 .git/config。
 * 始终设置 GIT_TERMINAL_PROMPT=0，避免凭据错误时 git 挂起等待终端输入。
 */
async function getGit(
  libraryPath: string,
  authType: string | null = null,
  credentials: string | null = null
): Promise<SimpleGit> {
  const root = getLibraryRoot(libraryPath);
  // SSH 模式要传 GIT_SSH_COMMAND，必须显式解锁 simple-git 的对应安全类别
  const git = simpleGit(root, {
    unsafe: { allowUnsafeSshCommand: authType === 'ssh' && !!credentials },
  });

  // 确保 Git 信任当前库目录，避免 "dubious ownership" 错误
  // 当 .git 目录属于其他用户（如 root），Git 会拒绝操作
  await ensureSafeDirectory(git, root);

  const extra: Record<string, string> = {};
  // SSH 模式下通过环境变量指定私钥，不写进仓库的 .git/config —— 那是用户的
  // 仓库，Web Note 不该往里面塞自己的配置
  if (authType === 'ssh' && credentials) {
    extra.GIT_SSH_COMMAND = `ssh -i ${credentials} -o StrictHostKeyChecking=accept-new`;
  }

  // 剔除 simple-git 会拦截的环境变量（如 PAGER），并固定 GIT_TERMINAL_PROMPT=0
  const gitWithEnv = git.env(safeGitEnv(extra));

  return gitWithEnv;
}

/**
 * 确保 Git 信任当前库目录，避免 "dubious ownership" 错误。
 *
 * 当 .git 目录属于其他用户（如 root），而容器以 webnote 用户运行时，
 * Git 会拒绝操作该仓库。将库路径加入 safe.directory 后，Git 就会信任它。
 * 重复添加不会导致错误，这里先检查是否已存在以避免配置文件冗长。
 */
async function ensureSafeDirectory(git: SimpleGit, root: string): Promise<void> {
  try {
    const existing = await git.raw(['config', '--global', '--get-all', 'safe.directory']);
    if (
      existing
        .split('\n')
        .map((s) => s.trim())
        .includes(root)
    )
      return;
  } catch {
    // 配置不存在或读取失败，继续尝试添加
  }
  try {
    await git.raw(['config', '--global', '--add', 'safe.directory', root]);
  } catch {
    // 忽略错误，后续 git 命令会报出更明确的错误
  }
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

/**
 * 测试 Git 远程连接：执行 `git ls-remote` 验证远程仓库可达性和凭据。
 * 不写入任何配置，只做只读探测。
 */
gitRoutes.post('/:libraryId/test', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

  const gitConfig = await getGitConfig(libraryId);
  if (!gitConfig?.remoteUrl) {
    throw new ValidationError('No remote URL configured');
  }

  // 先做前置校验：密钥解不开、认证方式与远端协议不一致，都直接说清楚原因
  assertCredentialsUsable(gitConfig, gitConfig.authType === 'https');
  assertAuthTypeMatchesRemote(gitConfig.remoteUrl, gitConfig.authType, gitConfig.credentials);

  const git = await getGit(library.path, gitConfig.authType, gitConfig.credentials);

  // 构造用于测试的 remote：HTTPS 时嵌入凭据；SSH 时依赖 GIT_SSH_COMMAND 环境变量
  let testRemote: string;
  if (gitConfig.authType === 'https' && gitConfig.credentials) {
    try {
      testRemote = buildAuthenticatedRemote(gitConfig.remoteUrl, gitConfig.credentials);
    } catch {
      testRemote = gitConfig.remoteUrl;
    }
  } else {
    testRemote = gitConfig.remoteUrl;
  }

  try {
    await git.raw(['ls-remote', testRemote]);
    auditLog({
      userId,
      libraryId,
      action: 'git.test',
      resourceType: 'git',
      metadata: { remote: gitConfig.remoteUrl },
    });
    return c.json({ success: true, data: { message: 'Connection successful' } });
  } catch (error) {
    throw new ValidationError(
      `Connection test failed: ${sanitizeGitError(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
});

/**
 * 去掉 URL 里内嵌的凭据。
 *
 * 仓库的 remote 有可能写成 `https://user:token@host/repo.git`（用户自己配的，
 * 或者被工具写进去的）。这份配置会被读出来预填到表单里，所以先把凭据摘掉，
 * 免得明文出现在界面和日志中。
 */
function stripCredentials(remoteUrl: string): string {
  if (!remoteUrl) return '';
  try {
    const url = new URL(remoteUrl);
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
      // 去掉空的用户信息后，URL 会以 //host 开头，补回协议
      return url.toString();
    }
    return remoteUrl;
  } catch {
    // 不是标准 URL（比如 scp 形式的 git@host:path），原样返回
    return remoteUrl;
  }
}

/**
 * 检测库目录里已存在的 Git 仓库，读出它的 remote 和当前分支。
 *
 * 注册一个本来就带 .git 的目录时，这些信息在 Web Note 自己的配置里并不存在
 * （用户还没填过任何 Git 设置）。把它读出来，前端就能把表单预填成仓库的真实
 * 情况，而不是让用户对着一个空的 remote 输入框猜。
 */
/**
 * 读取仓库形态上会影响 Web Note 行为的几项：浅克隆、core.worktree 指向库外、
 * SHA-256 对象格式。全部只读，失败就当没有（不影响 detect 的其他信息）。
 */
async function inspectRepositoryShape(git: SimpleGit): Promise<{
  isShallow: boolean;
  objectFormat: 'sha1' | 'sha256' | 'unknown';
  warnings: RepoConfigWarning[];
}> {
  const warnings: RepoConfigWarning[] = [];

  const isShallow =
    (await git.raw(['rev-parse', '--is-shallow-repository']).catch(() => 'false')).trim() ===
    'true';
  if (isShallow) {
    warnings.push({
      key: 'shallow-clone',
      reason:
        '这是浅克隆仓库，历史不完整：历史/差异视图会缺少更早的提交，推送前请先执行完整拉取（git fetch --unshallow）',
      severity: 'medium',
    });
  }

  // core.worktree 会让 git 把工作区指向库目录之外，Web Note 的所有读写都会跑偏
  const worktree = (await git.raw(['config', '--get', 'core.worktree']).catch(() => '')).trim();
  if (worktree) {
    warnings.push({
      key: 'core.worktree',
      reason: `core.worktree 指向库目录之外（${worktree}），Web Note 的文件读写与提交会作用到错误的位置`,
      severity: 'high',
    });
  }

  const format = (await git.raw(['config', '--get', 'extensions.objectFormat']).catch(() => ''))
    .trim()
    .toLowerCase();
  const objectFormat = format === 'sha256' ? 'sha256' : format === '' ? 'sha1' : 'unknown';
  if (objectFormat === 'sha256') {
    warnings.push({
      key: 'extensions.objectFormat',
      reason: '仓库使用 SHA-256 对象格式，托管平台与部分工具尚不完全支持',
      severity: 'medium',
    });
  }

  return { isShallow, objectFormat, warnings };
}

gitRoutes.get('/:libraryId/detect', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');

  const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

  // 同样剔除会被 simple-git 拦截的环境变量（如 PAGER）
  const git = simpleGit(getLibraryRoot(library.path)).env(safeGitEnv());

  // 裸仓库（.git 目录本身，或 clone --bare 的目录）没有工作区：文件读写、
  // 提交都没法进行。这种情况要给专门的提示，而不是笼统的"不是仓库"。
  const isBare = (await git.raw(['rev-parse', '--is-bare-repository']).catch(() => 'false')).trim();
  if (isBare === 'true') {
    return c.json({
      success: true,
      data: {
        isRepository: true,
        isBareRepository: true,
        remotes: [],
        branch: null,
        upstream: null,
        configWarnings: [
          {
            key: 'core.bare',
            reason: '这是一个裸仓库（没有工作区），Web Note 无法在其中编辑文件或提交',
            severity: 'high',
          } satisfies RepoConfigWarning,
        ],
      },
    });
  }

  try {
    await git.revparse(['--is-inside-work-tree']);
  } catch {
    return c.json({
      success: true,
      data: { isRepository: false, remotes: [], branch: null, upstream: null },
    });
  }

  const remotes = await git.getRemotes(true);

  // 导入的仓库常带着自己的 .git/config：认证头、凭据助手、URL 改写、SSH 命令、
  // LFS 过滤器……这些会偏离 Web Note 的预期（有的还会执行外部程序），
  // 需要在界面上提示用户，而不是等 push 失败时才发现。
  let configWarnings: RepoConfigWarning[] = [];
  try {
    const raw = await git.raw(['config', '--local', '-z', '--list']);
    configWarnings = inspectRepositoryConfig(raw);
  } catch {
    // 读不到就当没有（老版本 git 或权限问题），不影响 detect 的其他信息
  }

  // 仓库形态检测：浅克隆、core.worktree 指向库外、SHA-256 对象格式都会让
  // 之后的历史/推送行为与预期不同，这里一次性收集起来。
  const repository = await inspectRepositoryShape(git);
  for (const warning of repository.warnings) {
    configWarnings.push(warning);
  }

  // 未产生首个提交时 HEAD 是 unborn，rev-parse 会报错；symbolic-ref 仍能给出分支名
  let branch: string | null = null;
  try {
    branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim() || null;
  } catch {
    try {
      branch = (await git.raw(['symbolic-ref', '--short', 'HEAD'])).trim() || null;
    } catch {
      branch = null;
    }
  }

  let upstream: string | null = null;
  try {
    const tracking = await git.raw(['rev-parse', '--abbrev-ref', '@{upstream}']);
    const value = tracking.trim();
    upstream = value && value !== '@{upstream}' ? value : null;
  } catch {
    upstream = null;
  }

  return c.json({
    success: true,
    data: {
      isRepository: true,
      isBareRepository: false,
      isShallow: repository.isShallow,
      objectFormat: repository.objectFormat,
      remotes: remotes.map((r) => ({
        name: r.name,
        url: stripCredentials(r.refs.push || r.refs.fetch || ''),
        fetchUrl: stripCredentials(r.refs.fetch || ''),
        pushUrl: stripCredentials(r.refs.push || ''),
      })),
      branch,
      upstream,
      configWarnings,
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

    // 与自动备份一致：仓库没配置 user.name/email 时用 Web Note 兜底，
    // 否则全新仓库在 Web Note 里永远提交不了（git 报 "Committer identity unknown"）
    for (const [key, fallback] of [
      ['user.name', 'Web Note'],
      ['user.email', 'webnote@local'],
    ] as const) {
      try {
        await git.raw(['config', '--local', key]);
      } catch {
        await git.raw(['config', '--local', key, fallback]);
      }
    }

    // 冲突必须在 `git add` 之前检查：`git add .` 会把带冲突标记的文件
    // 标记为已解决，之后 diff --diff-filter=U 就查不到了
    const conflicted = await git.raw(['diff', '--name-only', '--diff-filter=U']);
    if (conflicted.trim()) {
      throw new ValidationError(
        `Unresolved merge conflicts in: ${conflicted.trim().split('\n').slice(0, 5).join(', ')}. Resolve them before committing.`
      );
    }

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
    // 有远端配置才校验凭据；纯本地仓库（无 remoteUrl）照常 commit/push 到 origin
    if (gitConfig?.remoteUrl) {
      assertCredentialsUsable(gitConfig, gitConfig.authType === 'https');
      assertAuthTypeMatchesRemote(gitConfig.remoteUrl, gitConfig.authType, gitConfig.credentials);
    }
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

    // 未显式传 branch 时：优先用配置的分支，否则推送当前分支。
    // 直接 `git push <url>` 在 push.default=simple 且 URL 无 upstream 时必然失败。
    let branchToPush = branch ?? gitConfig?.branch;
    if (!branchToPush) {
      try {
        branchToPush = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
      } catch {
        branchToPush = 'main';
      }
    }

    try {
      await git.push(resolvedRemote, branchToPush, force ? ['--force'] : []);
    } catch (error) {
      throw new ValidationError(
        `Push failed: ${sanitizeGitError(error instanceof Error ? error.message : 'Unknown error')}`
      );
    }

    auditLog({
      userId,
      libraryId,
      action: 'git.push',
      resourceType: 'git',
      metadata: { remote, branch: branchToPush, force },
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
    if (gitConfig?.remoteUrl) {
      assertCredentialsUsable(gitConfig, gitConfig.authType === 'https');
      assertAuthTypeMatchesRemote(gitConfig.remoteUrl, gitConfig.authType, gitConfig.credentials);
    }
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

    // 未显式传 branch 时：优先用配置的分支，否则用当前分支（见 push 的说明）
    let branchToPull = branch ?? gitConfig?.branch;
    if (!branchToPull) {
      try {
        branchToPull = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
      } catch {
        branchToPull = 'main';
      }
    }

    try {
      await git.pull(resolvedRemote, branchToPull, rebase ? ['--rebase'] : []);
    } catch (error) {
      throw new ValidationError(
        `Pull failed: ${sanitizeGitError(error instanceof Error ? error.message : 'Unknown error')}`
      );
    }

    auditLog({
      userId,
      libraryId,
      action: 'git.pull',
      resourceType: 'git',
      metadata: { remote, branch: branchToPull, rebase },
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
        `Restore failed: ${sanitizeGitError(error instanceof Error ? error.message : 'Unknown error')}`
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
