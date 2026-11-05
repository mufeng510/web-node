/**
 * HTTPS remote 的凭据处理工具。
 *
 * 凭据（token 或 "user:password"）只在单次 git 子进程操作中以 URL 内嵌的方式
 * 生效，绝不写回仓库的 .git/config，也绝不出现在日志和返回给前端的错误里。
 */

/**
 * 把凭据嵌入 HTTPS remote URL。
 *
 * credentials 格式：
 * - 纯 token（如 `ghp_…` / `github_pat_…`）：作为用户名，密码留空
 * - "username:password"：按**第一个**冒号切分，password 可再含冒号
 *
 * 凭据通过 URL API 写入，特殊字符会被正确百分号编码。
 * 远程 URL 非法或非 HTTP(S) 时抛出异常，由调用方决定如何降级。
 */
export function buildAuthenticatedRemote(remoteUrl: string, credentials: string): string {
  const url = new URL(remoteUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsupported remote protocol: ${url.protocol}`);
  }
  const separator = credentials.indexOf(':');
  if (separator === -1) {
    url.username = credentials;
    url.password = '';
    return url.toString();
  }
  url.username = credentials.slice(0, separator);
  url.password = credentials.slice(separator + 1);
  return url.toString();
}

/**
 * simple-git 的安全检查会拒绝执行：当子进程环境（env）里出现 PAGER、
 * GIT_SSH_COMMAND、GIT_CONFIG_* 等变量时直接抛错（"Use of X is not permitted
 * without enabling …"）。而我们 `...process.env` 继承的环境里很可能带着
 * PAGER（本开发机就有），导致 git 一启动就失败。
 *
 * 这里从继承的环境里剔除 simple-git 会拦截的键，只保留 git 正常工作所需的
 * 东西（PATH/HOME/代理变量等），并固定 GIT_TERMINAL_PROMPT=0。
 * 调用方显式传入的 extra 不经过过滤（由调用方负责安全，例如 GIT_SSH_COMMAND）。
 */
const BLOCKED_ENV_KEYS = new Set([
  'editor',
  'pager',
  'prefix',
  'ssh_askpass',
  'git_askpass',
  'git_editor',
  'git_exec_path',
  'git_external_diff',
  'git_pager',
  'git_proxy_command',
  'git_sequence_editor',
  'git_ssh',
  'git_ssh_command',
  'git_template_dir',
]);

export function safeGitEnv(
  extra: Record<string, string> = {},
  sourceEnv: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const env: Record<string, string> = { GIT_TERMINAL_PROMPT: '0' };
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase().trim();
    if (BLOCKED_ENV_KEYS.has(lower)) continue;
    // git_config_count / git_config_key_* / git_config_value_* / git_config_global / git_config_system
    if (lower.startsWith('git_config')) continue;
    env[key] = value;
  }
  return { ...env, ...extra };
}

/**
 * 抹除任意文本中 URL 内嵌的凭据（`scheme://user:pass@host` → `scheme://***@host`，
 * `scheme://token@host` → `scheme://***@host`）。
 *
 * git 的报错（如 `fatal: unable to access 'https://token@…'`）会原样带出凭据，
 * 回传给前端或写进日志之前必须过一遍这里。
 */
export function sanitizeGitError(message: string): string {
  return message.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@'"]+(?::[^/\s@'"]*)?@/gi, '$1***@');
}
