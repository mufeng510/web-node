import {
  buildAuthenticatedRemote,
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
