import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { RevealPageSections } from '@/components/Reveal';
import { StructuredData } from '@/components/StructuredData';
import { site } from '@/lib/site';
import { buildOrganizationSchema, buildWebsiteSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: 'Nhôm Eurohouse | Nhôm kiến trúc và công nghiệp', template: '%s | Eurohouse' },
  description: site.description,
  applicationName: 'Eurohouse',
  keywords: ['nhôm Eurohouse', 'nhôm kiến trúc', 'nhôm định hình', 'Ecento 70', 'Ecento Plus', 'hệ 55 vát cạnh'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: site.url,
    siteName: site.name,
    title: 'Nhôm Eurohouse | Nhôm kiến trúc và công nghiệp',
    description: site.description,
    images: [{ url: '/images/v4/hero-project.jpg', width: 1600, height: 1600, alt: 'Công trình nhôm kiến trúc Eurohouse' }],
  },
  twitter: { card: 'summary_large_image', title: 'Nhôm Eurohouse', description: site.description, images: ['/images/v4/hero-project.jpg'] },
  icons: { icon: '/brand/logo-mark.png', apple: '/brand/logo-mark.png' },
};

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap', variable: '--font-inter' });

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f47c20' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <StructuredData data={[buildOrganizationSchema(), buildWebsiteSchema()]} />
        <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
        <Header />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <RevealPageSections />
        <Footer />
      </body>
    </html>
  );
}
