/**
 * HTTPS remote 的凭据处理工具。
 *
 * 凭据（token 或 "user:password"）只在单次 git 子进程操作中以 URL 内嵌的方式
 * 生效，绝不写回仓库的 .git/config，也绝不出现在日志和返回给前端的错误里。
 */

/**
 * 纯 token 作为用户名直接发时，GitHub 会用「密码为空」的 Basic 认证，返回 401
 * （只有少数老路径会把它当密码处理）。把 token 同时用于用户名和密码可以过，
 * 但更稳妥、也符合 GitHub 文档的是 x-access-token 作为用户名。
 *
 * 仅当凭据看起来是 token（无冒号、常见前缀、无空格）时才这样映射，避免把
 * 「只有用户名」的误解当作 token 处理。
 */
const TOKEN_PATTERN =
  /^(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+|ATBB[A-Za-z0-9_-]+)$/;

function asTokenPassword(credentials: string): { username: string; password: string } | null {
  if (!TOKEN_PATTERN.test(credentials)) return null;
  return { username: 'x-access-token', password: credentials };
}

/**
 * 把凭据嵌入 HTTPS remote URL。
 *
 * credentials 格式：
 * - 纯 token（如 `ghp_…` / `github_pat_…` / `glpat-…`）：映射为
 *   `x-access-token:<token>`；无法识别为 token 的纯字符串按旧行为作为用户名
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
    const token = asTokenPassword(credentials);
    url.username = token ? token.username : credentials;
    url.password = token ? token.password : '';
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

/**
 * 无法凭校验的密钥问题，但可以用「没有凭据」在报错里区分开——
 * 见 routes.ts 的 CREDENTIAL_DECRYPT_HINT。
 */
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
  // 代理账号密码可能被写进 http_proxy（http://user:pass@proxy:port），
  // 脱敏后仍能走代理，只是不再自动认证——总比把密码带进日志强。
  for (const key of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']) {
    const value = env[key];
    if (value && /\/\/[^/\s@]+@/.test(value)) {
      env[key] = value.replace(/(\/\/)[^/\s@]+@/, '$1');
    }
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

/** 仓库自带配置中，会让 Web Note 的 git 调用行为偏离预期或执行外部程序的项 */
const REPO_CONFIG_RULES: {
  match: (key: string) => boolean;
  reason: string;
  severity: 'high' | 'medium';
}[] = [
  {
    match: (k) => k === 'http.extraheader',
    reason: '仓库自带认证头会覆盖 Web Note 的凭据，并可能被日志带出',
    severity: 'high',
  },
  {
    match: (k) => k.startsWith('credential.'),
    reason: '会调用外部凭据程序（容器里通常不存在）',
    severity: 'high',
  },
  {
    match: (k) => k.startsWith('url.') && k.endsWith('.insteadof'),
    reason: 'URL 改写规则会替换实际访问的地址',
    severity: 'high',
  },
  {
    match: (k) => /^remote\..*\.(receive|upload)pack$/.test(k),
    reason: '推送/拉取会执行指定程序',
    severity: 'high',
  },
  {
    match: (k) => k.startsWith('core.sshcommand'),
    reason: 'SSH 命令写死，私钥路径在容器里通常不存在（会覆盖 Web Note 的设置）',
    severity: 'medium',
  },
  {
    match: (k) => k.startsWith('http.') && (k.endsWith('.sslverify') || k.endsWith('.proxy')),
    reason: '会改变 TLS 校验或代理设置',
    severity: 'medium',
  },
  {
    match: (k) => k === 'core.hookspath',
    reason: '提交会运行自定义钩子',
    severity: 'medium',
  },
  {
    match: (k) => k === 'core.fsmonitor',
    reason: '会启动外部进程监视文件',
    severity: 'medium',
  },
  {
    match: (k) => k.startsWith('filter.'),
    reason: 'clean/smudge 过滤器需要外部程序（如 Git LFS）',
    severity: 'medium',
  },
  {
    match: (k) => k === 'commit.gpgsign' || k === 'gpg.program',
    reason: '提交需要 GPG 签名，容器里通常没有',
    severity: 'medium',
  },
];

export type RepoConfigWarning = { key: string; reason: string; severity: 'high' | 'medium' };

/**
 * 根据 `git config --local -z --list` 的输出，检查导入仓库自带的配置。
 *
 * 导入的库往往带着别人（或桌面端工具）写下的 .git/config：认证头、凭据助手、
 * URL 改写、SSH 命令、LFS 过滤器……这些会悄悄改变 Web Note 的行为，而且
 * 相关取值里可能就有明文凭据。这里只做只读检查，返回给界面的值全部脱敏。
 */
export function inspectRepositoryConfig(raw: string): RepoConfigWarning[] {
  const warnings: RepoConfigWarning[] = [];
  for (const entry of raw.split('\0')) {
    if (!entry) continue;
    const splitAt = entry.indexOf('\n');
    const key = (splitAt === -1 ? entry : entry.slice(0, splitAt)).toLowerCase().trim();
    const rule = REPO_CONFIG_RULES.find((r) => r.match(key));
    if (rule) warnings.push({ key, reason: rule.reason, severity: rule.severity });
  }
  return warnings;
}

/**
 * 导入仓库时，用哪几条信息判断"Web Note 需要接管它"。
 * 认证方式与远端协议不一致、远端指向 SSH 而容器里没有私钥，都会让
 * 一键自动备份持续失败，所以导入时就该告诉用户。
 */
export function classifyRemote(remoteUrl: string): 'https' | 'ssh' | 'other' {
  if (/^https?:\/\//i.test(remoteUrl)) return 'https';
  if (/^ssh:\/\//i.test(remoteUrl) || /^[^/\s]+@[^/\s]+:/.test(remoteUrl)) return 'ssh';
  return 'other';
}

/** SSH 凭据应当是私钥文件路径；不是路径就说明填错了 */
export function isPrivateKeyPath(credentials: string): boolean {
  return credentials.startsWith('/') || credentials.startsWith('~/');
}
