import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';

// getEnv() 在密钥缺失/过短时会直接 process.exit，必须在加载模块前设置
process.env.MASTER_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

type CsrfModule = typeof import('@backend/modules/auth/csrf');
let csrf: CsrfModule;
let app: Hono;

const SESSION_COOKIE = 'webnote_session';

beforeAll(async () => {
  csrf = await import('@backend/modules/auth/csrf');
  app = buildApp();
});

/** Minimal app mirroring app.ts: the middleware on /api/*, auth-free routes. */
function buildApp() {
  const app = new Hono();
  app.use('/api/*', csrf.csrfMiddleware());
  app.post('/api/protected', (c) => c.json({ ok: true }));
  app.post('/api/v1/mcp/tools', (c) => c.json({ ok: true }));
  app.get('/api/protected', (c) => c.json({ ok: true }));
  // 登录类路由：负责在响应里下发 CSRF token
  app.post('/api/auth/login', (c) => {
    c.header('Set-Cookie', `${SESSION_COOKIE}=tok; HttpOnly; Path=/;`, { append: true });
    csrf.setCsrfToken(c);
    return c.json({ ok: true });
  });
  app.post('/api/auth/logout', (c) => {
    csrf.clearCsrfCookie(c);
    return c.json({ ok: true });
  });
  return app;
}

/** 从 Set-Cookie 列表里取出某个 cookie 的值 */
function cookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0] ?? '';
    const [key = '', value] = pair.split('=');
    if (key.trim() === name) return value ?? '';
  }
  return null;
}

describe('csrfMiddleware', () => {
  it('放行无会话的写请求（登录、初始化等）', async () => {
    const res = await app.request('/api/protected', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('放行安全方法（GET/HEAD/OPTIONS）', async () => {
    const res = await app.request('/api/protected', {
      method: 'GET',
      headers: { cookie: `${SESSION_COOKIE}=tok` },
    });
    expect(res.status).toBe(200);
  });

  it('有会话但缺 CSRF 头时拒绝', async () => {
    const res = await app.request('/api/protected', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE}=tok` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('有会话、有头但缺 CSRF cookie 时拒绝', async () => {
    const res = await app.request('/api/protected', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE}=tok`, 'x-csrf-token': 'abc' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CSRF_TOKEN_MISSING');
  });

  it('token 与 cookie 哈希不匹配时拒绝', async () => {
    const res = await app.request('/api/protected', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE}=tok; webnote_csrf=${csrf.hashCsrfToken('right-token')}`,
        'x-csrf-token': 'wrong-token',
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('登录下发的 token 可用于后续写请求', async () => {
    const login = await app.request('/api/auth/login', { method: 'POST' });
    expect(login.status).toBe(200);

    const setCookies = login.headers.getSetCookie();
    const rawToken = login.headers.get('x-csrf-token');
    const csrfCookie = cookieValue(setCookies, 'webnote_csrf');

    expect(rawToken).toBeTruthy();
    expect(csrfCookie).toBeTruthy();
    // cookie 里只能有哈希，绝不能是原始 token
    expect(csrfCookie).not.toBe(rawToken);
    expect(csrfCookie).toBe(csrf.hashCsrfToken(rawToken as string));

    const res = await app.request('/api/protected', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE}=tok; webnote_csrf=${csrfCookie}`,
        'x-csrf-token': rawToken as string,
      },
    });
    expect(res.status).toBe(200);
  });

  it('登出时清除 CSRF cookie', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' });
    const csrfCookie = cookieValue(res.headers.getSetCookie(), 'webnote_csrf');
    expect(csrfCookie).toBe('');
  });

  it('Bearer 请求不校验 CSRF（MCP / API 客户端）', async () => {
    const res = await app.request('/api/v1/mcp/tools', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE}=tok`,
        authorization: 'Bearer some-token',
      },
    });
    expect(res.status).toBe(200);
  });

  it('MCP 前缀即使带会话 cookie 也放行', async () => {
    const res = await app.request('/api/v1/mcp/tools', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE}=tok` },
    });
    expect(res.status).toBe(200);
  });
});

describe('csrf token helpers', () => {
  it('verifyCsrfToken 只接受哈希匹配的 token', () => {
    const token = 'the-token';
    const hash = csrf.hashCsrfToken(token);
    expect(csrf.verifyCsrfToken(token, hash)).toBe(true);
    expect(csrf.verifyCsrfToken('other', hash)).toBe(false);
    expect(csrf.verifyCsrfToken(token, 'too-short')).toBe(false);
  });

  it('getCsrfFromCookie 能在多个 cookie 中找到 csrf cookie', () => {
    const c = {
      req: { header: () => 'a=1; webnote_csrf=hash; b=2' },
    } as never;
    expect(csrf.getCsrfFromCookie(c)).toBe('hash');
  });
});
