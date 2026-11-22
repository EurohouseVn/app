import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Nhôm Eurohouse', short_name: 'Eurohouse', description: 'Nền tảng nhôm kiến trúc và công nghiệp Eurohouse', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#f47c20', lang: 'vi', icons: [{ src: '/brand/logo-mark.png', sizes: '512x512', type: 'image/png' }] };
}
