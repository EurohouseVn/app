/* Service worker tối thiểu cho web NPP (PWA).
 * - Tệp tĩnh /_next/static và biểu tượng: lấy từ bộ nhớ đệm trước, cập nhật nền.
 * - Trang (điều hướng): ưu tiên mạng; mất mạng thì mở bản đã lưu của chính trang đó, hoặc trang /scan.
 * - Không bao giờ lưu lời gọi API hay dữ liệu đăng nhập: kho và đơn hàng luôn lấy trực tiếp từ máy chủ.
 */
const CACHE = 'eurohouse-npp-v1';
const OFFLINE_START = '/scan';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_START).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('eurohouse-npp-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API nằm ở tên miền khác: không đụng tới

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        return cached || network;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_START)) || Response.error()),
    );
  }
});
