import { apiUrl } from '../auth';

export { apiUrl };

// Gốc server (bỏ "/api") để dựng URL ảnh tĩnh từ /static/...
export const serverUrl = apiUrl.replace(/\/api\/?$/, '');

export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${serverUrl}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  return (await response.json()) as T;
}

export async function apiSend<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Lỗi ${path} (${response.status})`);
  }
  return (await response.json()) as T;
}
