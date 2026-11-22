import { resolveApiUrl } from './apiUrl';

// Biến EXPO_PUBLIC_* phải viết nguyên văn để Metro nhúng giá trị lúc build.
// Bản phát hành (không phải __DEV__) bắt buộc https; app.config.ts đã chặn từ lúc build.
export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, { requireSecure: !__DEV__ });

// Gốc server (bỏ "/api") để dựng URL ảnh tĩnh từ /static/...
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

// Token JWT hiện tại, được AuthProvider set sau khi đăng nhập / khôi phục phiên.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// Được AuthProvider gán để tự đăng xuất khi API trả 401.
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isNetworkError(error: unknown): boolean {
  return !(error instanceof ApiError);
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/images/')) return `${SERVER_URL}/static${path}`;
  return `${SERVER_URL}${path}`;
}

/** Mặc định 30 giây; việc chậm như trợ lý AI đặt `timeoutMs` riêng. */
type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 30000);
  try {
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options ?? {};
    const response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, signal: fetchOptions.signal ?? controller.signal });
    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      const payload = await response.json().catch(() => null);
      throw new ApiError(payload?.message ?? `API ${path} lỗi ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Máy chủ phản hồi quá chậm. Vui lòng kiểm tra mạng và thử lại.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};

export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
