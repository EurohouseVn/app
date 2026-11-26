import './home.css';
import { AppDownload } from '@/components/AppDownload';
import { CapabilityStrip } from '@/components/home/CapabilityStrip';
import { ConversionPanel } from '@/components/home/ConversionPanel';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { HomeHero } from '@/components/home/HomeHero';
import { IndustrialServices } from '@/components/home/IndustrialServices';
import { PrimaryVideo } from '@/components/home/PrimaryVideo';
import { ProductFamilyChooser } from '@/components/home/ProductFamilyChooser';
import { SpecialistSystems } from '@/components/home/SpecialistSystems';
import { SystemExplorer } from '@/components/home/SystemExplorer';
import { composeHomepageContent, type HomepageContent } from '@/lib/homepage-content';
import { getPublishedContent, listPublishedContent } from '@/lib/public-api';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Nhôm Eurohouse cho kiến trúc và công nghiệp',
  description: 'EUROHOUSE cung cấp hệ nhôm kiến trúc cao cấp, nhôm định hình công nghiệp theo bản vẽ, catalog và tư vấn kỹ thuật cho công trình.',
  canonicalPath: '/',
  image: '/images/v4/hero-project.jpg',
  imageAlt: 'Giải pháp nhôm kiến trúc và nhôm công nghiệp Eurohouse',
});

export default async function HomePage() {
  const content = await loadHomepageContent();

  return (
    <>
      <HomeHero />
      <ProductFamilyChooser />
      <SystemExplorer />
      <SpecialistSystems />
      <IndustrialServices />
      <CapabilityStrip />
      <FeaturedProjects content={content} />
      <PrimaryVideo video={content.primaryVideo} />
      <ConversionPanel />
      <AppDownload />
    </>
  );
}

async function loadHomepageContent(): Promise<HomepageContent> {
  if (!process.env.API_URL) return composeHomepageContent([]);

  try {
    const listing = await listPublishedContent({ page: 1 });
    const details = await Promise.all(
      listing.items.slice(0, 16).map((item) => getPublishedContent(item.slug, item.locale)),
    );

    return composeHomepageContent(
      details.filter((item) => item !== null).map((content) => ({ content, publicationStatus: 'PUBLISHED' as const })),
    );
  } catch {
    return composeHomepageContent([]);
  }
}
import type { Metadata } from 'next';
