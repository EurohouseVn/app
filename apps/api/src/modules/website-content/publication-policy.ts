import type {
  WebsitePublicationStatus,
  WebsiteReviewDecision,
  WebsiteReviewStage,
} from '@eurohouse/types';

export type WebsitePublicationPolicyErrorCode =
  | 'INVALID_TRANSITION'
  | 'INVALID_PUBLISH_STATUS'
  | 'TECHNICAL_REVIEW_REQUIRED'
  | 'MARKETING_REVIEW_REQUIRED'
  | 'SOURCE_REFERENCE_REQUIRED';

export class WebsitePublicationPolicyError extends Error {
  constructor(
    readonly code: WebsitePublicationPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WebsitePublicationPolicyError';
  }
}

const ALLOWED_TRANSITIONS: Record<WebsitePublicationStatus, readonly WebsitePublicationStatus[]> = {
  DRAFT: ['TECHNICAL_REVIEW'],
  TECHNICAL_REVIEW: ['DRAFT', 'MARKETING_REVIEW'],
  MARKETING_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function allowedWebsiteTransition(
  from: WebsitePublicationStatus,
  to: WebsitePublicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertWebsiteTransition(
  from: WebsitePublicationStatus,
  to: WebsitePublicationStatus,
): void {
  if (!allowedWebsiteTransition(from, to)) {
    throw new WebsitePublicationPolicyError(
      'INVALID_TRANSITION',
      `Website revision cannot transition from ${from} to ${to}.`,
    );
  }
}

type ReviewDecision = {
  stage: WebsiteReviewStage;
  decision: WebsiteReviewDecision;
};

function latestDecision(reviews: readonly ReviewDecision[], stage: WebsiteReviewStage) {
  let latest: WebsiteReviewDecision | undefined;
  for (const review of reviews) {
    if (review.stage === stage) latest = review.decision;
  }
  return latest;
}

export function resolveTechnicalApprovalCarryForward(input: {
  currentTechnicalRiskHash: string;
  previousRevision?: {
    id: string;
    technicalRiskHash: string | null;
    isImmediatelyPreceding: boolean;
    reviews: readonly ReviewDecision[];
  } | null;
}): { allowed: false } | { allowed: true; sourceRevisionId: string } {
  const previous = input.previousRevision;
  if (
    !previous
    || !previous.isImmediatelyPreceding
    || !previous.technicalRiskHash
    || previous.technicalRiskHash !== input.currentTechnicalRiskHash
    || latestDecision(previous.reviews, 'TECHNICAL') !== 'APPROVED'
  ) {
    return { allowed: false };
  }

  return { allowed: true, sourceRevisionId: previous.id };
}

function hasSourceReferences(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

export function assertRevisionPublishable(input: {
  status: WebsitePublicationStatus;
  reviews: ReviewDecision[];
  hasHighRiskClaims: boolean;
  sourceRefs: unknown;
}): void {
  if (input.status !== 'MARKETING_REVIEW') {
    throw new WebsitePublicationPolicyError(
      'INVALID_PUBLISH_STATUS',
      'Only a revision in marketing review can be published.',
    );
  }
  if (latestDecision(input.reviews, 'TECHNICAL') !== 'APPROVED') {
    throw new WebsitePublicationPolicyError(
      'TECHNICAL_REVIEW_REQUIRED',
      'The latest technical review must be approved.',
    );
  }
  if (latestDecision(input.reviews, 'MARKETING') !== 'APPROVED') {
    throw new WebsitePublicationPolicyError(
      'MARKETING_REVIEW_REQUIRED',
      'The latest marketing review must be approved.',
    );
  }
  if (input.hasHighRiskClaims && !hasSourceReferences(input.sourceRefs)) {
    throw new WebsitePublicationPolicyError(
      'SOURCE_REFERENCE_REQUIRED',
      'High-risk claims require at least one source reference.',
    );
  }
}
