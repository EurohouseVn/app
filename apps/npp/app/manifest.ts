import type { MetadataRoute } from 'next';

/** Cài web NPP lên màn hình chính điện thoại/máy tính như một ứng dụng. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eurohouse NPP',
    short_name: 'NPP',
    description: 'Quản lý đơn hàng, kho kính và quét mã vạch cho Nhà phân phối Eurohouse',
    lang: 'vi',
    start_url: '/scan',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F8FB',
    theme_color: '#F79009',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
