import type {
  PublicMediaProjection,
  PublicWebsiteContentDetail,
  WebsitePublicationStatus,
} from '@eurohouse/types';

export type HomepageCandidate = {
  content: PublicWebsiteContentDetail;
  publicationStatus: WebsitePublicationStatus | 'DRAFT';
};

export type HomepageCard = {
  id: string;
  slug: string;
  kind: PublicWebsiteContentDetail['kind'];
  family?: PublicWebsiteContentDetail['family'];
  title: string;
  eyebrow?: string;
  summary: string;
  image?: Pick<PublicMediaProjection, 'url' | 'altText' | 'width' | 'height'>;
};

export type HomepageVideo = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  url: string;
  posterUrl: string;
  altText: string;
  caption: string;
  transcript: string;
};

export type HomepageContent = {
  residential: HomepageCard[];
  industrial: HomepageCard[];
  projects: HomepageCard[];
  resources: HomepageCard[];
  primaryVideo?: HomepageVideo;
};

export function composeHomepageContent(candidates: readonly HomepageCandidate[]): HomepageContent {
  const published = candidates.filter((candidate) => candidate.publicationStatus === 'PUBLISHED');
  const cards = published.map(({ content }) => toCard(content));

  return {
    residential: cards.filter((item) => item.family === 'RESIDENTIAL').slice(0, 4),
    industrial: cards.filter((item) => item.family === 'INDUSTRIAL').slice(0, 5),
    projects: cards.filter((item) => item.kind === 'CASE_STUDY').slice(0, 3),
    resources: cards.filter((item) => ['ARTICLE', 'PAGE'].includes(item.kind)).slice(0, 3),
    primaryVideo: selectPrimaryVideo(published),
  };
}

function toCard(content: PublicWebsiteContentDetail): HomepageCard {
  const image = content.media.find((item) => item.mediaType === 'IMAGE' && item.url.startsWith('/'));
  return {
    id: content.id,
    slug: content.slug,
    kind: content.kind,
    family: content.family,
    title: content.title,
    eyebrow: content.eyebrow,
    summary: content.summary,
    ...(image ? {
      image: {
        url: image.url,
        altText: image.altText,
        width: image.width,
        height: image.height,
      },
    } : {}),
  };
}

function selectPrimaryVideo(candidates: readonly HomepageCandidate[]): HomepageVideo | undefined {
  for (const { content } of candidates) {
    const media = content.media.find((item) =>
      item.mediaType === 'VIDEO'
      && Boolean(item.posterUrl)
      && item.posterUrl?.startsWith('/')
      && Boolean(item.transcript?.trim() || item.caption?.trim() || content.summary.trim()),
    );
    if (!media?.posterUrl) continue;

    return {
      id: media.id,
      slug: content.slug,
      title: content.title,
      summary: content.summary,
      url: media.url,
      posterUrl: media.posterUrl,
      altText: media.altText,
      caption: media.caption?.trim() || content.title,
      transcript: media.transcript?.trim() || content.summary,
    };
  }

  return undefined;
}
