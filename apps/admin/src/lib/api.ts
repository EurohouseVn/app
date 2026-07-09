import { apiUrl, clearSession, getToken } from '../auth';

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
    if (typeof window !== 'undefined') window.location.reload();
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  }
  return (await response.json()) as T;
}

export async function apiSend<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Lỗi ${path} (${response.status})`);
  }
  return (await response.json()) as T;
}

// Mở file (PDF...) từ endpoint cần Bearer token bằng cách tải blob rồi mở qua object URL.
export async function openAuthedFile(path: string): Promise<void> {
  const response = await fetch(`${apiUrl}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Tải PDF (cần Bearer) vào iframe ẩn rồi tự bật hộp thoại In của trình duyệt.
export async function printAuthedFile(path: string): Promise<void> {
  const response = await fetch(`${apiUrl}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new Error(`Không tải được ${path} (lỗi ${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  }, 60_000);
}
