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
    const git = simpleGit(getLibraryRoot(libraryPath));

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
      console.log(`[AutoBackup] Library ${libraryId}: no changes to back up`);
      return;
    }

    // 配置 HTTPS 凭据（如需要）
    if (gitConfig.authType === 'https' && gitConfig.credentials) {
      try {
        const decrypted = decrypt(gitConfig.credentials);
        const url = new URL(gitConfig.remoteUrl || '');
        if (decrypted.includes(':')) {
          const [user = '', pass = ''] = decrypted.split(':');
          url.username = user;
          url.password = pass;
        } else {
          url.username = decrypted;
        }
        await git.raw(['remote', 'set-url', 'origin', url.toString()]);
      } catch {
        // 忽略凭据配置失败，push 阶段会报错
      }
    }

    // SSH 模式：配置 core.sshCommand
    if (gitConfig.authType === 'ssh' && gitConfig.credentials) {
      try {
        const decrypted = decrypt(gitConfig.credentials);
        await git.raw([
          'config',
          'core.sshCommand',
          `ssh -i ${decrypted} -o StrictHostKeyChecking=accept-new`,
        ]);
      } catch {
        // 忽略
      }
    }

    // git commit
    const commit = await git.commit('Auto backup', {
      '--no-verify': null,
      '--author': 'Web Note <webnote@local>',
    });

    // git push（如有 remoteUrl）
    if (gitConfig.remoteUrl) {
      const resolvedRemote =
        gitConfig.authType === 'https' && gitConfig.credentials
          ? (() => {
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
                return url.toString();
              } catch {
                return 'origin';
              }
            })()
          : 'origin';
      await git.push(resolvedRemote, gitConfig.branch || 'main');
    }

    // 更新 lastBackupAt
    await db
      .update(gitConfigs)
      .set({ lastBackupAt: new Date(), updatedAt: new Date() })
      .where(eq(gitConfigs.libraryId, libraryId));

    auditLog({
      userId: 'system',
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

/** 供外部手动触发单个库的备份（如库更新后） */
export async function triggerBackup(libraryId: string, libraryPath: string, gitConfig: any) {
  await runAutoBackup(libraryId, libraryPath, gitConfig);
}

export type { SimpleGit };
