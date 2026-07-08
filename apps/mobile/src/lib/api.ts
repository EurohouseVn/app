const fallback = 'http://localhost:3001/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallback;

// Gốc server (bỏ "/api") để dựng URL ảnh tĩnh từ /static/...
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

// Token JWT hiện tại, được AuthProvider set sau khi đăng nhập / khôi phục phiên.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// Được AuthProvider gán để tự đăng xuất khi API trả 401.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${SERVER_URL}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `API ${path} lỗi ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
