import type { Context, Next } from 'hono';
import { getEnv } from '../config/env.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { extractTokenFromCookie, validateSession } from './auth.js';

export function authMiddleware(allowedRoles?: string[]) {
  return async (c: Context, next: Next) => {
    const env = getEnv();
    const token = extractTokenFromCookie(c.req.header('cookie'), env.SESSION_COOKIE_NAME);

    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    const session = await validateSession(token);
    if (!session) {
      throw new AuthenticationError('Invalid or expired session');
    }

    c.set('userId', session.user.id);
    c.set('userRole', session.user.role);
    c.set('sessionId', session.id);

    if (allowedRoles && !allowedRoles.includes(session.user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }

    return next();
  };
}

export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const env = getEnv();
    const token = extractTokenFromCookie(c.req.header('cookie'), env.SESSION_COOKIE_NAME);

    if (token) {
      const session = await validateSession(token);
      if (session) {
        c.set('userId', session.user.id);
        c.set('userRole', session.user.role);
        c.set('sessionId', session.id);
      }
    }

    return next();
  };
}
