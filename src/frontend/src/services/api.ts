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

export function setSuppressAuthRedirect(value: boolean) {
  suppressAuthRedirect = value;
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
    return Promise.reject(error);
  }
);

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export { api };
