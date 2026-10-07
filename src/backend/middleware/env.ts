/**
 * The values a request carries after authentication.
 *
 * Declaring them here is what lets `c.get('userId')` return a string instead of
 * `unknown`, and it is why every router is built as `new Hono<Env>()`.
 */
export interface Env {
  Variables: {
    requestId: string;
    userId: string;
    userRole: string;
    sessionId: string;
  };
}
