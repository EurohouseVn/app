'use client';

import { useEffect } from 'react';

/** Đăng ký service worker để cài web NPP như ứng dụng. Chỉ chạy ở bản chính thức: bản dev sẽ bị bộ nhớ đệm làm rối. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
  }, []);
  return null;
}
