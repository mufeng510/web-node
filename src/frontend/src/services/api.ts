import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let csrfToken: string | null = null;
let suppressAuthRedirect = true;

/**
 * Envelope the response interceptor below hands to callers. Must stay a
 * discriminated union: `data?: T` would leave the payload optional everywhere.
 */
export type ApiResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error?: { code: string; message: string } };

export function setSuppressAuthRedirect(value: boolean) {
  suppressAuthRedirect = value;
}

export function withSuppressedAuthRedirect<T>(fn: () => Promise<T>): Promise<T> {
  const prev = suppressAuthRedirect;
  suppressAuthRedirect = true;
  return fn().finally(() => {
    suppressAuthRedirect = prev;
  });
}

type RetryableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
    config.headers['x-csrf-token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const newCsrf = response.headers['x-csrf-token'];
    if (newCsrf) {
      csrfToken = newCsrf;
    }
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      return response.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    // 后端在 CSRF 令牌缺失/失配时会删除旧 cookie、下发新令牌并返回 403
    // `CSRF_TOKEN_REFRESHED`。这里收下新令牌并静默重试一次，用户无感；
    // 只重试一次，避免异常情况下打成死循环。
    const refreshedToken = error.response?.headers?.['x-csrf-token'] as string | undefined;
    if (refreshedToken) {
      csrfToken = refreshedToken;
    }
    const original = error.config as RetryableConfig | undefined;
    const code = (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
    if (refreshedToken && code === 'CSRF_TOKEN_REFRESHED' && original && !original._csrfRetried) {
      original._csrfRetried = true;
      return api.request(original);
    }

    if (error.response?.status === 401 && !suppressAuthRedirect) {
      window.location.href = '/login';
    }
    // axios 默认抛出的 message 是 "Request failed with status code 401"，
    // 后端那句真正有用的说明（密码错误、账号被锁……）就丢了。这里把它接到
    // 错误对象上，界面上才能显示给人看。
    const payload = error.response?.data as { error?: { message?: string } } | undefined;
    const serverMessage = payload?.error?.message;
    if (serverMessage) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  }
);

/**
 * 清掉当前内存里的 CSRF token。
 *
 * 需要“重置为未认证状态”时使用（例如 `/auth/me` 返回 401）：此时浏览器里
 * 可能仍残留 CSRF cookie，若继续用旧 token，之后的写请求会被中间件判为无效。
 * 清空后要等下一次登录/初始化重新下发 token。
 */
export function resetCsrfToken() {
  csrfToken = null;
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export { api };
