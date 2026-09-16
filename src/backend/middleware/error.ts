import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getErrorResponse } from '../../utils/errors.js';

export function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') || createId();

  if (err instanceof HTTPException) {
    return c.json(getErrorResponse(err, requestId), err.status);
  }

  console.error(`[${requestId}] Unhandled error:`, err);

  return c.json(getErrorResponse(err, requestId), 500);
}

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}
