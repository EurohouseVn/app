// Resolves the API base URL. Dependency-free so app.config.ts can reuse it
// to stop preview/production builds that would ship without a real API.

export const DEV_FALLBACK_API_URL = 'http://127.0.0.1:3001/api';

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

export function resolveApiUrl(raw: string | undefined, options: { requireSecure: boolean }): string {
  const value = raw?.trim().replace(/\/+$/, '') ?? '';

  if (!value) {
    if (!options.requireSecure) return DEV_FALLBACK_API_URL;
    throw new Error('EXPO_PUBLIC_API_URL chưa được đặt cho bản build phát hành.');
  }

  if (!options.requireSecure) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL không hợp lệ: ${value}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Bản build phát hành phải gọi API qua https, đang là: ${value}`);
  }
  if (LOOPBACK_HOST.test(url.hostname)) {
    throw new Error(`Bản build phát hành không được trỏ API về localhost hoặc 127.0.0.1: ${value}`);
  }
  return value;
}
