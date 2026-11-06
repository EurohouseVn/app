import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WebsitePublicationPolicyError,
  allowedWebsiteTransition,
  assertRevisionPublishable,
  resolveTechnicalApprovalCarryForward,
} from './publication-policy';

test('publication state machine allows only the approved forward lifecycle', () => {
  assert.equal(allowedWebsiteTransition('DRAFT', 'TECHNICAL_REVIEW'), true);
  assert.equal(allowedWebsiteTransition('TECHNICAL_REVIEW', 'MARKETING_REVIEW'), true);
  assert.equal(allowedWebsiteTransition('MARKETING_REVIEW', 'PUBLISHED'), true);
  assert.equal(allowedWebsiteTransition('PUBLISHED', 'ARCHIVED'), true);
});

test('review rejection returns a revision to draft', () => {
  assert.equal(allowedWebsiteTransition('TECHNICAL_REVIEW', 'DRAFT'), true);
  assert.equal(allowedWebsiteTransition('MARKETING_REVIEW', 'DRAFT'), true);
});

test('publication state machine rejects skips and published in-place edits', () => {
  assert.equal(allowedWebsiteTransition('DRAFT', 'MARKETING_REVIEW'), false);
  assert.equal(allowedWebsiteTransition('DRAFT', 'PUBLISHED'), false);
  assert.equal(allowedWebsiteTransition('TECHNICAL_REVIEW', 'PUBLISHED'), false);
  assert.equal(allowedWebsiteTransition('PUBLISHED', 'DRAFT'), false);
  assert.equal(allowedWebsiteTransition('ARCHIVED', 'DRAFT'), false);
});

test('publish requires latest approval from both review stages', () => {
  assert.doesNotThrow(() => assertRevisionPublishable({
    status: 'MARKETING_REVIEW',
    reviews: [
      { stage: 'TECHNICAL', decision: 'APPROVED' },
      { stage: 'MARKETING', decision: 'APPROVED' },
    ],
    hasHighRiskClaims: false,
    sourceRefs: null,
  }));

  assert.throws(
    () => assertRevisionPublishable({
      status: 'MARKETING_REVIEW',
      reviews: [{ stage: 'MARKETING', decision: 'APPROVED' }],
      hasHighRiskClaims: false,
      sourceRefs: null,
    }),
    (error: unknown) => error instanceof WebsitePublicationPolicyError && error.code === 'TECHNICAL_REVIEW_REQUIRED',
  );
});

test('latest decision for each stage is authoritative', () => {
  assert.throws(
    () => assertRevisionPublishable({
      status: 'MARKETING_REVIEW',
      reviews: [
        { stage: 'TECHNICAL', decision: 'APPROVED' },
        { stage: 'MARKETING', decision: 'APPROVED' },
        { stage: 'TECHNICAL', decision: 'CHANGES_REQUESTED' },
      ],
      hasHighRiskClaims: false,
      sourceRefs: null,
    }),
    (error: unknown) => error instanceof WebsitePublicationPolicyError && error.code === 'TECHNICAL_REVIEW_REQUIRED',
  );
});

test('high-risk claims require a non-empty source reference', () => {
  const approved = {
    status: 'MARKETING_REVIEW' as const,
    reviews: [
      { stage: 'TECHNICAL' as const, decision: 'APPROVED' as const },
      { stage: 'MARKETING' as const, decision: 'APPROVED' as const },
    ],
    hasHighRiskClaims: true,
  };

  assert.throws(
    () => assertRevisionPublishable({ ...approved, sourceRefs: [] }),
    (error: unknown) => error instanceof WebsitePublicationPolicyError && error.code === 'SOURCE_REFERENCE_REQUIRED',
  );
  assert.doesNotThrow(() => assertRevisionPublishable({ ...approved, sourceRefs: [{ source: 'Catalog R19' }] }));
});

test('publish assertion rejects a revision outside marketing review', () => {
  assert.throws(
    () => assertRevisionPublishable({
      status: 'DRAFT',
      reviews: [
        { stage: 'TECHNICAL', decision: 'APPROVED' },
        { stage: 'MARKETING', decision: 'APPROVED' },
      ],
      hasHighRiskClaims: false,
      sourceRefs: null,
    }),
    (error: unknown) => error instanceof WebsitePublicationPolicyError && error.code === 'INVALID_PUBLISH_STATUS',
  );
});

test('technical approval carries only from the immediately preceding approved revision with the same hash', () => {
  const approvedPrevious = {
    id: 'revision-4',
    technicalRiskHash: 'same-hash',
    isImmediatelyPreceding: true,
    reviews: [{ stage: 'TECHNICAL' as const, decision: 'APPROVED' as const }],
  };
  assert.deepEqual(resolveTechnicalApprovalCarryForward({
    currentTechnicalRiskHash: 'same-hash',
    previousRevision: approvedPrevious,
  }), { allowed: true, sourceRevisionId: 'revision-4' });

  assert.equal(resolveTechnicalApprovalCarryForward({
    currentTechnicalRiskHash: 'changed-hash',
    previousRevision: approvedPrevious,
  }).allowed, false);
  assert.equal(resolveTechnicalApprovalCarryForward({
    currentTechnicalRiskHash: 'same-hash',
    previousRevision: { ...approvedPrevious, isImmediatelyPreceding: false },
  }).allowed, false);
  assert.equal(resolveTechnicalApprovalCarryForward({
    currentTechnicalRiskHash: 'same-hash',
    previousRevision: {
      ...approvedPrevious,
      reviews: [{ stage: 'TECHNICAL', decision: 'CHANGES_REQUESTED' as const }],
    },
  }).allowed, false);
});

test('marketing approval never carries to a new revision', () => {
  const result = resolveTechnicalApprovalCarryForward({
    currentTechnicalRiskHash: 'same-hash',
    previousRevision: {
      id: 'revision-4',
      technicalRiskHash: 'same-hash',
      isImmediatelyPreceding: true,
      reviews: [
        { stage: 'TECHNICAL', decision: 'APPROVED' },
        { stage: 'MARKETING', decision: 'APPROVED' },
      ],
    },
  });
  assert.deepEqual(result, { allowed: true, sourceRevisionId: 'revision-4' });
  assert.equal('marketingApprovalCarried' in result, false);
});
