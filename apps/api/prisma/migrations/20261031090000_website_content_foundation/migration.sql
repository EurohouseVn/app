-- Website public presentation and publication governance.
-- This migration is additive: operational catalog, project, user and storage data remain authoritative.

CREATE TYPE "WebsiteProductFamily" AS ENUM ('RESIDENTIAL', 'INDUSTRIAL');
CREATE TYPE "WebsiteChannel" AS ENUM ('PUBLIC', 'NPP', 'ADMIN_ONLY');
CREATE TYPE "WebsiteContentKind" AS ENUM ('PRODUCT', 'INDUSTRIAL_SERVICE', 'SOLUTION', 'CASE_STUDY', 'PAGE', 'ARTICLE', 'FAQ', 'VIDEO');
CREATE TYPE "WebsitePublicationStatus" AS ENUM ('DRAFT', 'TECHNICAL_REVIEW', 'MARKETING_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "WebsiteReviewStage" AS ENUM ('TECHNICAL', 'MARKETING');
CREATE TYPE "WebsiteReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');
CREATE TYPE "WebsiteMediaIntakeStatus" AS ENUM ('DISCOVERED', 'REVIEWED', 'APPROVED', 'OPTIMIZED', 'PUBLISHED', 'REJECTED');
CREATE TYPE "WebsiteRightsStatus" AS ENUM ('UNKNOWN', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "WebsiteMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "Lead"
  ADD COLUMN "leadType" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "referrer" TEXT,
  ADD COLUMN "utm" JSONB,
  ADD COLUMN "consentAt" TIMESTAMP(3);

CREATE TABLE "WebsiteContent" (
  "id" TEXT NOT NULL,
  "kind" "WebsiteContentKind" NOT NULL,
  "family" "WebsiteProductFamily",
  "slug" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'vi',
  "aluSystemId" TEXT,
  "operationalProjectId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteContentRevision" (
  "id" TEXT NOT NULL,
  "websiteContentId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" "WebsitePublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "eyebrow" TEXT,
  "summary" TEXT NOT NULL,
  "body" JSONB NOT NULL,
  "specifications" JSONB,
  "sourceRefs" JSONB,
  "hasHighRiskClaims" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteContentReview" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "stage" "WebsiteReviewStage" NOT NULL,
  "decision" "WebsiteReviewDecision" NOT NULL,
  "note" TEXT,
  "reviewerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteContentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteSeoRecord" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "canonicalPath" TEXT NOT NULL,
  "schemaType" TEXT NOT NULL,
  "reviewDate" TIMESTAMP(3),
  "reviewerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteSeoRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteMediaAsset" (
  "id" TEXT NOT NULL,
  "storageObjectId" TEXT NOT NULL,
  "mediaType" "WebsiteMediaType" NOT NULL,
  "sourceReference" TEXT NOT NULL DEFAULT '',
  "rightsStatus" "WebsiteRightsStatus" NOT NULL DEFAULT 'UNKNOWN',
  "altText" TEXT NOT NULL DEFAULT '',
  "caption" TEXT,
  "posterStorageObjectId" TEXT,
  "transcript" TEXT,
  "focalPointX" DOUBLE PRECISION,
  "focalPointY" DOUBLE PRECISION,
  "channels" "WebsiteChannel"[] DEFAULT ARRAY['ADMIN_ONLY']::"WebsiteChannel"[],
  "intakeStatus" "WebsiteMediaIntakeStatus" NOT NULL DEFAULT 'DISCOVERED',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteContentMedia" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'CONTENT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WebsiteContentMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteTechnicalDocument" (
  "id" TEXT NOT NULL,
  "storageObjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "revisionLabel" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "channels" "WebsiteChannel"[] DEFAULT ARRAY['ADMIN_ONLY']::"WebsiteChannel"[],
  "aluSystemId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteTechnicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteContentDocument" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WebsiteContentDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteRedirect" (
  "id" TEXT NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "destinationPath" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 301,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteRedirect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsitePublicationAudit" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsitePublicationAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteContent_locale_slug_key" ON "WebsiteContent"("locale", "slug");
CREATE INDEX "WebsiteContent_kind_family_idx" ON "WebsiteContent"("kind", "family");
CREATE INDEX "WebsiteContent_aluSystemId_idx" ON "WebsiteContent"("aluSystemId");
CREATE INDEX "WebsiteContent_operationalProjectId_idx" ON "WebsiteContent"("operationalProjectId");

CREATE UNIQUE INDEX "WebsiteContentRevision_content_revision_key" ON "WebsiteContentRevision"("websiteContentId", "revision");
CREATE INDEX "WebsiteContentRevision_status_updatedAt_idx" ON "WebsiteContentRevision"("status", "updatedAt");

CREATE INDEX "WebsiteContentReview_revision_stage_created_idx" ON "WebsiteContentReview"("revisionId", "stage", "createdAt");
CREATE INDEX "WebsiteContentReview_reviewer_created_idx" ON "WebsiteContentReview"("reviewerId", "createdAt");

CREATE UNIQUE INDEX "WebsiteSeoRecord_revisionId_key" ON "WebsiteSeoRecord"("revisionId");
CREATE INDEX "WebsiteSeoRecord_canonicalPath_idx" ON "WebsiteSeoRecord"("canonicalPath");
CREATE INDEX "WebsiteSeoRecord_reviewDate_idx" ON "WebsiteSeoRecord"("reviewDate");

CREATE UNIQUE INDEX "WebsiteMediaAsset_storageObjectId_key" ON "WebsiteMediaAsset"("storageObjectId");
CREATE INDEX "WebsiteMediaAsset_intake_rights_idx" ON "WebsiteMediaAsset"("intakeStatus", "rightsStatus");
CREATE INDEX "WebsiteMediaAsset_posterStorageObjectId_idx" ON "WebsiteMediaAsset"("posterStorageObjectId");

CREATE UNIQUE INDEX "WebsiteContentMedia_revision_media_role_key" ON "WebsiteContentMedia"("revisionId", "mediaAssetId", "role");
CREATE INDEX "WebsiteContentMedia_revision_sort_idx" ON "WebsiteContentMedia"("revisionId", "sortOrder");

CREATE UNIQUE INDEX "WebsiteTechnicalDocument_storageObjectId_key" ON "WebsiteTechnicalDocument"("storageObjectId");
CREATE INDEX "WebsiteTechnicalDocument_type_effective_idx" ON "WebsiteTechnicalDocument"("documentType", "effectiveDate");
CREATE INDEX "WebsiteTechnicalDocument_aluSystemId_idx" ON "WebsiteTechnicalDocument"("aluSystemId");

CREATE UNIQUE INDEX "WebsiteContentDocument_revision_document_key" ON "WebsiteContentDocument"("revisionId", "documentId");
CREATE INDEX "WebsiteContentDocument_revision_sort_idx" ON "WebsiteContentDocument"("revisionId", "sortOrder");

CREATE UNIQUE INDEX "WebsiteRedirect_sourcePath_key" ON "WebsiteRedirect"("sourcePath");
CREATE INDEX "WebsiteRedirect_active_source_idx" ON "WebsiteRedirect"("active", "sourcePath");

CREATE INDEX "WebsitePublicationAudit_entity_created_idx" ON "WebsitePublicationAudit"("entityType", "entityId", "createdAt");
CREATE INDEX "WebsitePublicationAudit_actor_created_idx" ON "WebsitePublicationAudit"("actorId", "createdAt");

ALTER TABLE "WebsiteContent" ADD CONSTRAINT "WebsiteContent_aluSystemId_fkey" FOREIGN KEY ("aluSystemId") REFERENCES "AluSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteContent" ADD CONSTRAINT "WebsiteContent_projectId_fkey" FOREIGN KEY ("operationalProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteContent" ADD CONSTRAINT "WebsiteContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteContentRevision" ADD CONSTRAINT "WebsiteRevision_contentId_fkey" FOREIGN KEY ("websiteContentId") REFERENCES "WebsiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteContentRevision" ADD CONSTRAINT "WebsiteRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteContentReview" ADD CONSTRAINT "WebsiteReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WebsiteContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteContentReview" ADD CONSTRAINT "WebsiteReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebsiteSeoRecord" ADD CONSTRAINT "WebsiteSeo_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WebsiteContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteSeoRecord" ADD CONSTRAINT "WebsiteSeo_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteMediaAsset" ADD CONSTRAINT "WebsiteMedia_storageObjectId_fkey" FOREIGN KEY ("storageObjectId") REFERENCES "StorageObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebsiteMediaAsset" ADD CONSTRAINT "WebsiteMedia_posterStorageId_fkey" FOREIGN KEY ("posterStorageObjectId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteMediaAsset" ADD CONSTRAINT "WebsiteMedia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteContentMedia" ADD CONSTRAINT "WebsiteContentMedia_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WebsiteContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteContentMedia" ADD CONSTRAINT "WebsiteContentMedia_assetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "WebsiteMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebsiteTechnicalDocument" ADD CONSTRAINT "WebsiteDocument_storageId_fkey" FOREIGN KEY ("storageObjectId") REFERENCES "StorageObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebsiteTechnicalDocument" ADD CONSTRAINT "WebsiteDocument_aluSystemId_fkey" FOREIGN KEY ("aluSystemId") REFERENCES "AluSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsiteTechnicalDocument" ADD CONSTRAINT "WebsiteDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WebsiteContentDocument" ADD CONSTRAINT "WebsiteContentDocument_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "WebsiteContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteContentDocument" ADD CONSTRAINT "WebsiteContentDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "WebsiteTechnicalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebsiteRedirect" ADD CONSTRAINT "WebsiteRedirect_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebsitePublicationAudit" ADD CONSTRAINT "WebsiteAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
