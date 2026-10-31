import { eq } from 'drizzle-orm';
import { type SimpleGit, simpleGit } from 'simple-git';
import { getDb } from '../../db/index.js';
import { gitConfigs } from '../../db/schema/git.js';
import { libraries } from '../../db/schema/libraries.js';
import { auditLog } from '../../middleware/audit.js';
import { decrypt } from '../../utils/crypto.js';
import { getLibraryRoot } from '../../utils/path.js';

/** 自动备份定时器句柄 */
let backupInterval: ReturnType<typeof setInterval> | null = null;

/** 正在执行备份的库，避免并发冲突 */
const backingUp = new Set<string>();

/** 把 cron 字段解析为允许的值集合 */
function parseCronField(expr: string, min: number, max: number): Set<number> {
  const result = new Set<number>();
  for (const part of expr.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) result.add(i);
    } else if (part.startsWith('*/')) {
      const step = Number.parseInt(part.slice(2), 10);
      if (Number.isNaN(step) || step <= 0) continue;
      for (let i = min; i <= max; i += step) result.add(i);
    } else {
      const v = Number.parseInt(part, 10);
      if (!Number.isNaN(v) && v >= min && v <= max) result.add(v);
    }
  }
  return result;
}

/** 判断给定的 Date 是否匹配 5 字段 cron 表达式 */
function matchesCron(cron: string, date: Date): boolean {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.trim().split(/\s+/);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;

  const allowed = {
    minute: parseCronField(minute, 0, 59),
    hour: parseCronField(hour, 0, 23),
    dayOfMonth: parseCronField(dayOfMonth, 1, 31),
    month: parseCronField(month, 1, 12),
    dayOfWeek: parseCronField(dayOfWeek, 0, 7),
  };

  const m = date.getMinutes();
  const h = date.getHours();
  const d = date.getDate();
  const mo = date.getMonth() + 1;
  const dw = date.getDay(); // 0 = Sunday

  return (
    allowed.minute.has(m) &&
    allowed.hour.has(h) &&
    allowed.dayOfMonth.has(d) &&
    allowed.month.has(mo) &&
    allowed.dayOfWeek.has(dw)
  );
}

/** 执行单个库的自动备份 */
async function runAutoBackup(libraryId: string, libraryPath: string, gitConfig: any) {
  if (backingUp.has(libraryId)) return;
  backingUp.add(libraryId);

  try {
    const db = getDb();
    const root = getLibraryRoot(libraryPath);
    let git = simpleGit(root);

    // 确保 Git 信任当前库目录，避免 "dubious ownership" 错误
    // 当 .git 目录属于其他用户（如 root），Git 会拒绝操作
    await ensureSafeDirectory(git, root);

    // SSH 模式：私钥路径通过环境变量传给 git 子进程，不写进仓库的 .git/config
    if (gitConfig.authType === 'ssh' && gitConfig.credentials) {
      try {
        const decrypted = decrypt(gitConfig.credentials);
        git = git.env({
          ...process.env,
          GIT_SSH_COMMAND: `ssh -i ${decrypted} -o StrictHostKeyChecking=accept-new`,
        });
      } catch {
        // 忽略，push 阶段会报错
      }
    }

    // 确保是 git 仓库
    try {
      await git.revparse(['--is-inside-work-tree']);
    } catch {
      console.log(`[AutoBackup] Library ${libraryId} is not a git repository, skipping`);
      return;
    }

    // git add .
    await git.add('.');

    const status = await git.status();
    if (status.files.length === 0 && status.not_added.length === 0) {
      // 没有未提交的更改，但仍然更新 lastBackupAt 表示自动备份已运行
      await db
        .update(gitConfigs)
        .set({ lastBackupAt: new Date(), updatedAt: new Date() })
        .where(eq(gitConfigs.libraryId, libraryId));
      console.log(`[AutoBackup] Library ${libraryId}: no changes to back up`);
      return;
    }

    /**
     * 凭据只在本次操作里生效，绝不写回仓库的 .git/config。
     *
     * 早先的实现用 `git remote set-url` 把带明文凭据的 URL 写进 .git/config，
     * 凭据因此以明文留在磁盘上，还可能随仓库一起被推走。这里改为把带凭据的
     * URL 直接作为 push 的目标传给 git，仓库自身的 origin 保持原样。
     */
    let pushRemote = 'origin';
    if (gitConfig.authType === 'https' && gitConfig.credentials && gitConfig.remoteUrl) {
      try {
        const decrypted = decrypt(gitConfig.credentials);
        const url = new URL(gitConfig.remoteUrl);
        if (decrypted.includes(':')) {
          const [user = '', pass = ''] = decrypted.split(':');
          url.username = user;
          url.password = pass;
        } else {
          url.username = decrypted;
        }
        pushRemote = url.toString();
      } catch {
        // 凭据解不开就退回用 origin，让 push 自己报错
        pushRemote = 'origin';
      }
    }

    // git commit
    const commit = await git.commit('Auto backup', {
      '--no-verify': null,
      '--author': 'Web Note <webnote@local>',
    });

    // 只要 commit 成功，就更新 lastBackupAt——push 失败不应抹掉这次备份记录
    await db
      .update(gitConfigs)
      .set({ lastBackupAt: new Date(), updatedAt: new Date() })
      .where(eq(gitConfigs.libraryId, libraryId));

    // git push（如有 remoteUrl）—— push 失败单独捕获，不影响 lastBackupAt
    if (gitConfig.remoteUrl) {
      try {
        await git.push(pushRemote, gitConfig.branch || 'main');
      } catch (pushError) {
        console.error(`[AutoBackup] Library ${libraryId}: push failed:`, pushError);
      }
    }

    auditLog({
      libraryId,
      action: 'git.commit',
      resourceType: 'git',
      resourceId: commit.commit,
      metadata: {
        message: 'Auto backup',
        files: status.files.map((f) => f.path),
        auto: true,
      },
    });

    console.log(`[AutoBackup] Library ${libraryId}: backed up to ${commit.commit.slice(0, 7)}`);
  } catch (error) {
    console.error(`[AutoBackup] Library ${libraryId}: backup failed:`, error);
  } finally {
    backingUp.delete(libraryId);
  }
}

/** 初始化所有启用自动备份的库的定时检查 */
export function initAutoBackup() {
  if (backupInterval) return;

  const db = getDb();

  async function tick() {
    try {
      const rows = await db
        .select()
        .from(gitConfigs)
        .innerJoin(libraries, eq(gitConfigs.libraryId, libraries.id))
        .where(eq(gitConfigs.autoBackup, true));

      const now = new Date();

      for (const { git_configs: gc, libraries: lib } of rows) {
        if (!gc.autoBackupSchedule) continue;

        // `enabled` 标志只存在于 libraries.gitConfig（JSON），未启用则不备份
        const jsonConfig = (lib.gitConfig ?? {}) as Record<string, unknown>;
        if (jsonConfig.enabled === false) continue;

        // 若距离上次备份不足 1 分钟，跳过（避免 cron 误触重复执行）
        if (gc.lastBackupAt && now.getTime() - new Date(gc.lastBackupAt).getTime() < 60_000) {
          continue;
        }

        if (matchesCron(gc.autoBackupSchedule, now)) {
          void runAutoBackup(gc.libraryId, lib.path, gc);
        }
      }
    } catch (error) {
      console.error('[AutoBackup] Tick error:', error);
    }
  }

  // 每分钟检查一次
  backupInterval = setInterval(tick, 60_000);
  // 立即执行一次，避免等待第一分钟
  void tick();

  console.log('[AutoBackup] Scheduler started (every 60s)');
}

/** 停止自动备份定时任务 */
export function stopAutoBackup() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log('[AutoBackup] Scheduler stopped');
  }
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

/** 供外部手动触发单个库的备份（如库更新后） */
export async function triggerBackup(libraryId: string, libraryPath: string, gitConfig: any) {
  await runAutoBackup(libraryId, libraryPath, gitConfig);
}

export type { SimpleGit };
