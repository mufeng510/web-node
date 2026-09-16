import type { Context, Next } from 'hono';
import { getEnv } from '../../config/env.js';
import { generateSecureToken, hashSecret } from '../../utils/crypto.js';

const CSRF_COOKIE_NAME = 'webnote_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  return generateSecureToken(32);
}

export function hashCsrfToken(token: string): string {
  return hashSecret(token);
}

export function verifyCsrfToken(token: string, hash: string): boolean {
  const computedHash = hashSecret(token);
  return hash === computedHash;
}

export function setCsrfCookie(c: Context, token: string) {
  const env = getEnv();
  c.header(
    'Set-Cookie',
    `${CSRF_COOKIE_NAME}=${hashSecret(token)}; HttpOnly; Secure=${env.NODE_ENV === 'production'}; SameSite=Strict; Path=/; Max-Age=${env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60}`
  );
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
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

export function csrfMiddleware() {
  return async (c: Context, next: Next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      return next();
    }

    if (!c.req.path.startsWith('/api/')) {
      return next();
    }

    const headerToken = getCsrfFromHeader(c);
    const cookieToken = getCsrfFromCookie(c);

    if (!headerToken || !cookieToken) {
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

    if (!verifyCsrfToken(headerToken, cookieToken)) {
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
