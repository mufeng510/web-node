import {
  buildAuthenticatedRemote,
  classifyRemote,
  inspectRepositoryConfig,
  safeGitEnv,
  sanitizeGitError,
} from '@backend/modules/git/remote';
import { describe, expect, it } from 'vitest';

describe('buildAuthenticatedRemote', () => {
  it('纯 token 作为用户名嵌入', () => {
    expect(buildAuthenticatedRemote('https://github.com/o/r.git', 'ghp_abc123')).toBe(
      'https://ghp_abc123@github.com/o/r.git'
    );
  });

  it('username:password 按第一个冒号切分，密码可含冒号', () => {
    expect(buildAuthenticatedRemote('https://github.com/o/r.git', 'me:p@ss:w0rd')).toBe(
      'https://me:p%40ss%3Aw0rd@github.com/o/r.git'
    );
  });

  it('凭据中的特殊字符会被百分号编码', () => {
    const result = buildAuthenticatedRemote('https://github.com/o/r.git', 'tok@en');
    expect(result).toBe('https://tok%40en@github.com/o/r.git');
  });

  it('remote URL 已带端口和路径时保留', () => {
    expect(buildAuthenticatedRemote('https://git.internal:8443/o/r.git', 't')).toBe(
      'https://t@git.internal:8443/o/r.git'
    );
  });

  it('非 HTTP(S) 协议抛出异常', () => {
    expect(() => buildAuthenticatedRemote('git@github.com:o/r.git', 't')).toThrow();
    expect(() => buildAuthenticatedRemote('ssh://git@example.com/o/r.git', 't')).toThrow();
  });

  it('空凭据按纯 token 处理（不抛异常）', () => {
    expect(buildAuthenticatedRemote('https://github.com/o/r.git', '')).toBe(
      'https://github.com/o/r.git'
    );
  });
});

describe('safeGitEnv', () => {
  it('剔除 simple-git 会拦截的 PAGER/GIT_SSH_COMMAND/GIT_CONFIG_*', () => {
    const env = safeGitEnv(
      {},
      {
        PATH: '/usr/bin',
        PAGER: 'less',
        GIT_SSH_COMMAND: 'ssh -i /x',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.pager',
        GIT_CONFIG_VALUE_0: 'less',
        GIT_CONFIG_GLOBAL: '/dev/null',
        http_proxy: 'http://proxy:8080',
      }
    );
    expect(env.PATH).toBe('/usr/bin');
    expect(env.PAGER).toBeUndefined();
    expect(env.GIT_SSH_COMMAND).toBeUndefined();
    expect(env.GIT_CONFIG_COUNT).toBeUndefined();
    expect(env.GIT_CONFIG_KEY_0).toBeUndefined();
    expect(env.GIT_CONFIG_GLOBAL).toBeUndefined();
    expect(env.http_proxy).toBe('http://proxy:8080');
  });

  it('固定 GIT_TERMINAL_PROMPT=0', () => {
    expect(safeGitEnv().GIT_TERMINAL_PROMPT).toBe('0');
  });

  it('剥掉代理 URL 里的账号密码，但保留代理本身', () => {
    const env = safeGitEnv({}, { http_proxy: 'http://user:secret@proxy:3128' });
    expect(env.http_proxy).toBe('http://proxy:3128');
    expect(JSON.stringify(env)).not.toContain('secret');
  });

  it('显式传入的 extra 原样保留（由调用方负责安全）', () => {
    const env = safeGitEnv({ GIT_SSH_COMMAND: 'ssh -i /tmp/key' });
    expect(env.GIT_SSH_COMMAND).toBe('ssh -i /tmp/key');
  });

  it('保留 PATH 和代理变量', () => {
    const env = safeGitEnv();
    expect(env.PATH).toBe(process.env.PATH);
  });
});

describe('sanitizeGitError', () => {
  it('抹除 user:password 形式的内嵌凭据', () => {
    const raw =
      "fatal: unable to access 'https://me:secretpass@github.com/o/r.git/': The requested URL returned error: 403";
    const out = sanitizeGitError(raw);
    expect(out).not.toContain('secretpass');
    expect(out).toContain('https://***@github.com');
  });

  it('抹除纯 token 形式的内嵌凭据', () => {
    const raw = "fatal: unable to access 'https://ghp_secret123@github.com/o/r.git/': 403";
    const out = sanitizeGitError(raw);
    expect(out).not.toContain('ghp_secret123');
    expect(out).toContain('https://***@github.com');
  });

  it('不含凭据的消息原样返回', () => {
    const raw = 'fatal: refusing to merge unrelated histories';
    expect(sanitizeGitError(raw)).toBe(raw);
  });
});

describe('inspectRepositoryConfig（导入仓库自带的 .git/config）', () => {
  const entry = (k: string, v: string) => `${k}\n${v}\0`;

  it('标记会覆盖认证头、调用外部程序的配置', () => {
    const raw =
      entry('core.repositoryformatversion', '0') +
      entry('http.extraheader', 'Authorization: Basic SECRET') +
      entry('credential.helper', 'store') +
      entry('core.fsmonitor', '/usr/bin/watch') +
      entry('filter.lfs.clean', 'git-lfs clean') +
      entry('user.name', 'Alice');
    const warnings = inspectRepositoryConfig(raw);
    const keys = warnings.map((w) => w.key).sort();
    expect(keys).toEqual([
      'core.fsmonitor',
      'credential.helper',
      'filter.lfs.clean',
      'http.extraheader',
    ]);
    // 正常的 user.* / remote.* 不应触发告警
    expect(keys).not.toContain('user.name');
    expect(warnings.find((w) => w.key === 'http.extraheader')?.severity).toBe('high');
  });

  it('普通仓库不产生告警', () => {
    const raw =
      entry('core.bare', 'false') +
      entry('remote.origin.url', 'https://github.com/o/r.git') +
      entry('branch.main.remote', 'origin');
    expect(inspectRepositoryConfig(raw)).toEqual([]);
  });

  it('识别 url.*.insteadOf 改写与 receivepack', () => {
    const raw =
      entry('url.git@github.com:.insteadOf', 'https://github.com/') +
      entry('remote.origin.receivepack', 'sh -c "curl evil"');
    const keys = inspectRepositoryConfig(raw).map((w) => w.key);
    expect(keys).toContain('url.git@github.com:.insteadof');
    expect(keys).toContain('remote.origin.receivepack');
  });
});

describe('classifyRemote', () => {
  it('区分 HTTPS / SSH / 其他', () => {
    expect(classifyRemote('https://github.com/o/r.git')).toBe('https');
    expect(classifyRemote('http://git.local/o/r.git')).toBe('https');
    expect(classifyRemote('git@github.com:o/r.git')).toBe('ssh');
    expect(classifyRemote('ssh://git@github.com:22/o/r.git')).toBe('ssh');
    expect(classifyRemote('/srv/git/r.git')).toBe('other');
    expect(classifyRemote('file:///srv/git/r.git')).toBe('other');
  });
});
