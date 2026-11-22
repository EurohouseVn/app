import { absoluteUrl } from './seo';

export type VideoMetadataInput = {
  name: string;
  description: string;
  thumbnailUrl: string;
  transcript: string;
  contentUrl?: string;
  embedUrl?: string;
  uploadDate?: string;
  duration?: string;
};

export function buildVideoSchema(input: VideoMetadataInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const thumbnailUrl = input.thumbnailUrl.trim();
  const transcript = input.transcript.trim();
  if (!name || !description || !thumbnailUrl || !transcript) return undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: absoluteUrl(thumbnailUrl),
    transcript,
    ...(input.contentUrl ? { contentUrl: absoluteUrl(input.contentUrl) } : {}),
    ...(input.embedUrl ? { embedUrl: absoluteUrl(input.embedUrl) } : {}),
    ...(input.uploadDate ? { uploadDate: input.uploadDate } : {}),
    ...(input.duration ? { duration: input.duration } : {}),
  };
}
