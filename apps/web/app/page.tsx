import { CapabilityStrip } from '@/components/home/CapabilityStrip';
import { ConversionPanel } from '@/components/home/ConversionPanel';
import { FeaturedProjects } from '@/components/home/FeaturedProjects';
import { FeaturedSystems } from '@/components/home/FeaturedSystems';
import { HomeHero } from '@/components/home/HomeHero';
import { PrimaryVideo } from '@/components/home/PrimaryVideo';
import { ProductFamilyChooser } from '@/components/home/ProductFamilyChooser';
import { composeHomepageContent, type HomepageContent } from '@/lib/homepage-content';
import { getPublishedContent, listPublishedContent } from '@/lib/public-api';

export default async function HomePage() {
  const content = await loadHomepageContent();

  return (
    <>
      <HomeHero />
      <ProductFamilyChooser />
      <FeaturedSystems content={content} />
      <CapabilityStrip />
      <FeaturedProjects content={content} />
      <PrimaryVideo video={content.primaryVideo} />
      <ConversionPanel />
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
