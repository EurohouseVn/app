import { apiUrl, clearSession, getToken, waitForToken } from '../auth';

export { apiUrl };

// Gốc server (bỏ "/api") để dựng URL ảnh tĩnh từ /static/...
export const serverUrl = apiUrl.replace(/\/api\/?$/, '');

export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${serverUrl}${path}`;
}

function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

function handleUnauthorized(status: number) {
  if (status === 401) {
    clearSession();
  }
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  await waitForToken();
  let response = await fetch(url, { ...init, headers: authHeaders(init.headers as Record<string, string> | undefined) });
  if (response.status === 401) {
    clearSession();
    const freshToken = await waitForToken();
    if (freshToken) response = await fetch(url, { ...init, headers: authHeaders(init.headers as Record<string, string> | undefined) });
  }
  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(`${apiUrl}${path}`);
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  }
  return (await response.json()) as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await authenticatedFetch(`${apiUrl}${path}`);
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  }
  return response.blob();
}

export async function apiSend<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await authenticatedFetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Lỗi ${path} (${response.status})`);
  }
  return (await response.json()) as T;
}
