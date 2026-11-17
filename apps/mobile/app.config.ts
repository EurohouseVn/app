import type { ConfigContext, ExpoConfig } from 'expo/config';

// Static settings live in app.json (so `eas init` / `expo install` can edit it).
// This file only layers the build variant on top.
//   development: local dev client, may use http/localhost API
//   preview:     internal test APK, installs next to the store app
//   production:  Play Store AAB
type Variant = 'development' | 'preview' | 'production';

const VARIANTS: Record<Variant, { nameSuffix: string; idSuffix: string }> = {
  development: { nameSuffix: ' (Dev)', idSuffix: '.dev' },
  preview: { nameSuffix: ' (Test)', idSuffix: '.preview' },
  production: { nameSuffix: '', idSuffix: '' },
};

// Kept inline: Expo's config loader only transpiles this file, not its imports.
// Same rules as src/lib/apiUrl.ts (covered by apiUrl.test.ts) for release builds.
function requireReleaseApiUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/\/+$/, '') ?? '';
  if (!value) throw new Error('EXPO_PUBLIC_API_URL chưa được đặt cho bản build phát hành.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL không hợp lệ: ${value}`);
  }
  if (url.protocol !== 'https:') throw new Error(`Bản build phát hành phải gọi API qua https, đang là: ${value}`);
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) {
    throw new Error(`Bản build phát hành không được trỏ API về localhost hoặc 127.0.0.1: ${value}`);
  }
  return value;
}

function readVariant(): Variant {
  const value = process.env.APP_VARIANT ?? 'development';
  if (value === 'development' || value === 'preview' || value === 'production') return value;
  throw new Error(`APP_VARIANT không hợp lệ: "${value}". Dùng development, preview hoặc production.`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = readVariant();
  const { nameSuffix, idSuffix } = VARIANTS[variant];

  // Stop a store/test build that would ship pointing at no API or at localhost.
  const apiUrl = variant === 'development' ? process.env.EXPO_PUBLIC_API_URL : requireReleaseApiUrl(process.env.EXPO_PUBLIC_API_URL);

  return {
    ...config,
    name: `${config.name}${nameSuffix}`,
    slug: config.slug ?? 'eurohouse-mobile',
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios?.bundleIdentifier}${idSuffix}`,
    },
    android: {
      ...config.android,
      package: `${config.android?.package}${idSuffix}`,
    },
    extra: {
      ...config.extra,
      appVariant: variant,
      apiUrl,
    },
  };
};
