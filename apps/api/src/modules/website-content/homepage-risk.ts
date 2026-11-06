import { createHash } from 'node:crypto';
import type { HomepageMediaRole, HomepagePayloadV1 } from '@eurohouse/types';

export type HomepageTechnicalRiskInput = {
  payload: HomepagePayloadV1;
  specifications?: unknown;
  sourceRefs?: unknown;
  references: Array<{
    contentId: string;
    publishedRevisionId: string;
  }>;
  media: Array<{
    role: HomepageMediaRole;
    mediaAssetId: string;
    caption?: string;
    transcript?: string;
  }>;
  seo?: unknown;
};

export type HomepageChangeClass = 'TECHNICAL_AND_MARKETING' | 'MARKETING_ONLY';

const TECHNICAL_MEDIA_ROLES = new Set<HomepageMediaRole>([
  'INDUSTRIAL_BACKGROUND',
  'EVIDENCE_1',
  'EVIDENCE_2',
  'EVIDENCE_3',
  'EVIDENCE_4',
  'VIDEO_PRIMARY',
]);

function normalizeTechnicalText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('vi')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTextTree(value: unknown): unknown {
  if (typeof value === 'string') return normalizeTechnicalText(value);
  if (Array.isArray(value)) return value.map(normalizeTextTree);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeTextTree(entry)]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function technicalMaterial(input: HomepageTechnicalRiskInput) {
  return {
    specifications: normalizeTextTree(input.specifications ?? null),
    sourceRefs: normalizeTextTree(input.sourceRefs ?? null),
    references: input.references
      .map(({ contentId, publishedRevisionId }) => ({ contentId, publishedRevisionId }))
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right))),
    industrial: normalizeTextTree({
      eyebrow: input.payload.industrial.eyebrow,
      title: input.payload.industrial.title,
      summary: input.payload.industrial.summary,
    }),
    evidence: normalizeTextTree({
      eyebrow: input.payload.evidence.eyebrow,
      title: input.payload.evidence.title,
      summary: input.payload.evidence.summary,
      items: input.payload.evidence.items,
    }),
    media: input.media
      .filter(({ role }) => TECHNICAL_MEDIA_ROLES.has(role))
      .map(({ role, mediaAssetId, caption, transcript }) => ({
        role,
        mediaAssetId,
        caption: normalizeTechnicalText(caption ?? ''),
        transcript: normalizeTechnicalText(transcript ?? ''),
      }))
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right))),
  };
}

export function computeHomepageTechnicalRiskHash(input: HomepageTechnicalRiskInput): string {
  return createHash('sha256').update(stableJson(technicalMaterial(input))).digest('hex');
}

export function classifyHomepageChange(
  before: HomepageTechnicalRiskInput,
  after: HomepageTechnicalRiskInput,
): HomepageChangeClass {
  return computeHomepageTechnicalRiskHash(before) === computeHomepageTechnicalRiskHash(after)
    ? 'MARKETING_ONLY'
    : 'TECHNICAL_AND_MARKETING';
}
