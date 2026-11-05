import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { getEnv } from '../../config/env.js';
import { cookieSecureAttr } from '../../middleware/auth.js';
import { generateSecureToken, hashSecret } from '../../utils/crypto.js';

export { hashSecret };

const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * 不在模块加载时取 env：getEnv 会缓存环境变量，而测试/多实例场景下环境
 * 可能在被 import 之后才设置。每次调用时读取。
 */
function csrfCookieName(): string {
  return getEnv().CSRF_COOKIE_NAME;
}

/** 不改变状态的请求方法，无需校验 CSRF */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 用 `Authorization: Bearer` 访问的 MCP 端点不依赖 cookie 会话，浏览器无法
 * 替用户伪造 Authorization 头，本身不受 CSRF 影响；且非浏览器客户端（如
 * OpenCode 的 MCP 集成）不会去读 CSRF cookie，强制校验只会把它们打挂。
 */
const BEARER_EXEMPT_PREFIXES = ['/api/v1/mcp'];

export function generateCsrfToken(): string {
  return generateSecureToken(32);
}

export function hashCsrfToken(token: string): string {
  return hashSecret(token);
}

export function verifyCsrfToken(token: string, hash: string): boolean {
  const computedHash = hashSecret(token);
  const a = Buffer.from(computedHash);
  const b = Buffer.from(String(hash));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * 清除 CSRF cookie（登出、改密等使旧 token 失效的场景）。
 */
export function clearCsrfCookie(c: Context) {
  const secure = cookieSecureAttr(c);
  c.header(
    'Set-Cookie',
    `${csrfCookieName()}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`,
    { append: true }
  );
}

/**
 * 签发新的 CSRF token：cookie 里存 SHA-256 哈希（HttpOnly 分发器），
 * 响应头 `x-csrf-token` 回传原始 token 给前端（由前端保存在内存里）。
 *
 * 双提交 + 哈希存储的判断方式见 csrfMiddleware：同源脚本能读到响应头，
 * 跨站页面读不到，因此伪造请求拿不到可用 token。
 */
export function setCsrfToken(c: Context): string {
  const env = getEnv();
  const secure = cookieSecureAttr(c);
  const token = generateCsrfToken();

  c.header(
    'Set-Cookie',
    `${csrfCookieName()}=${hashSecret(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60}`,
    { append: true }
  );
  c.header(CSRF_HEADER_NAME, token);

  return token;
}

export function getCsrfFromHeader(c: Context): string | null {
  return c.req.header(CSRF_HEADER_NAME) || null;
}

export function getCsrfFromCookie(c: Context): string | null {
  const cookieHeader = c.req.header('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c: string) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === csrfCookieName() && value !== undefined) {
      return value;
    }
  }
  return null;
}

function isBearerRequest(c: Context): boolean {
  return (c.req.header('authorization') || '').toLowerCase().startsWith('bearer ');
}

/**
 * CSRF 防护中间件，挂在 `/api/*` 上。
 *
 * 1. 只用 cookie 会话认证、且是状态改变方法的请求才校验——
 *    Bearer token 调用方拿不到 cookie，无法替用户伪造请求。
 * 2. 没带 cookie 会话的请求直接放行：没有会话就没有可被冒用的身份，
 *    认证中间件会照常拒绝。这样登录、初始化等无会话接口不受影响。
 * 3. 有会话时必须同时满足：请求头 `x-csrf-token` 存在、cookie 里存在哈希、
 *    且 `hash(header) === cookie`。前端拿不到原始 token 时会重新登录，
 *    而不是被永久卡住。
 */
export function csrfMiddleware() {
  return async (c: Context, next: Next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      return next();
    }

    if (BEARER_EXEMPT_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
      return next();
    }

    if (isBearerRequest(c)) {
      return next();
    }

    const env = getEnv();
    const hasSessionCookie = (c.req.header('cookie') || '')
      .split(';')
      .some((part) => part.trim().startsWith(`${env.SESSION_COOKIE_NAME}=`));
    if (!hasSessionCookie) {
      return next();
    }

    const headerToken = getCsrfFromHeader(c);
    const cookieHash = getCsrfFromCookie(c);

    if (!headerToken || !cookieHash) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token missing',
            requestId: c.get('requestId'),
          },
        },
        403
      );
    }

    if (!verifyCsrfToken(headerToken, cookieHash)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'Invalid CSRF token',
            requestId: c.get('requestId'),
          },
        },
        403
      );
    }

    return next();
  };
}
