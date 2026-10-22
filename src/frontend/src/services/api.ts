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
  (error: AxiosError) => {
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

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export { api };
