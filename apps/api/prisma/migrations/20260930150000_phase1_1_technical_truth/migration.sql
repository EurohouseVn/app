-- CreateEnum
CREATE TYPE "FixtureEvidenceKind" AS ENUM ('SYNTHETIC_CANDIDATE', 'REAL_MANUFACTURED');

-- CreateEnum
CREATE TYPE "ExpectedOutputRevisionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TechnicalIssueStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "CalculationComparisonKind" ADD VALUE IF NOT EXISTS 'TECHNICAL_TRUTH_THREE_WAY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DatasetVerificationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "DatasetVerificationStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_VERIFIED';
ALTER TYPE "DatasetVerificationStatus" ADD VALUE IF NOT EXISTS 'RETIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DifferenceClassification" ADD VALUE IF NOT EXISTS 'V2_MATCH_TECHNICAL';
ALTER TYPE "DifferenceClassification" ADD VALUE IF NOT EXISTS 'LEGACY_MATCH_TECHNICAL';
ALTER TYPE "DifferenceClassification" ADD VALUE IF NOT EXISTS 'BOTH_MATCH';
ALTER TYPE "DifferenceClassification" ADD VALUE IF NOT EXISTS 'BOTH_DIFFER';
ALTER TYPE "DifferenceClassification" ADD VALUE IF NOT EXISTS 'MISSING_TECHNICAL_TRUTH';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'PROFILE_DRAWING';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'SYSTEM_DRAWING';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'FABRICATION_DRAWING';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'CUTTING_FORMULA';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'HARDWARE_SPECIFICATION';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'GLASS_SPECIFICATION';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'PRODUCTION_CUTTING_SHEET';
ALTER TYPE "TechnicalSourceType" ADD VALUE IF NOT EXISTS 'SIGNED_TECHNICAL_CONFIRMATION';

-- AlterTable
ALTER TABLE "CalculationComparison" ADD COLUMN     "expectedOutputRevisionId" TEXT,
ADD COLUMN     "technicalTruthOutput" JSONB;

-- AlterTable
ALTER TABLE "CalculationDifference" ADD COLUMN     "approvedExpected" JSONB,
ADD COLUMN     "resolution" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "responsibleDatasetItem" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "responsibleRuleId" TEXT,
ADD COLUMN     "technicalSourceId" TEXT;

-- AlterTable
ALTER TABLE "DatasetRevision" ADD COLUMN     "coverageCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "verificationCoverage" JSONB,
ADD COLUMN     "verificationStatus" "DatasetVerificationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "GoldenFixture" ADD COLUMN     "evidenceKind" "FixtureEvidenceKind" NOT NULL DEFAULT 'SYNTHETIC_CANDIDATE',
ADD COLUMN     "verifiedExpectedOutputRevisionId" TEXT;

-- AlterTable
ALTER TABLE "ManufacturingRuleRecord" ADD COLUMN     "constants" JSONB,
ADD COLUMN     "sourceReference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "systemStableKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MaterialDataset" ALTER COLUMN "verificationStatus" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "TechnicalSource" ADD COLUMN     "ownerOrganizationId" TEXT,
ADD COLUMN     "reviewState" "TechnicalReviewState" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN     "sourceDate" TIMESTAMP(3),
ADD COLUMN     "technicalOwner" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ExpectedOutputRevision" (
    "id" TEXT NOT NULL,
    "goldenFixtureId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "ExpectedOutputRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "output" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL DEFAULT '',
    "technicalSourceId" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "technicalNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedOutputRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenFixtureRuleUsage" (
    "id" TEXT NOT NULL,
    "goldenFixtureId" TEXT NOT NULL,
    "ruleRecordId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldenFixtureRuleUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingTechnicalIssue" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT,
    "differenceId" TEXT,
    "responsibleRuleId" TEXT,
    "technicalSourceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TechnicalIssueStatus" NOT NULL DEFAULT 'OPEN',
    "responsibleDatasetItem" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '',
    "openedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingTechnicalIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpectedOutputRevision_status_idx" ON "ExpectedOutputRevision"("status");

-- CreateIndex
CREATE INDEX "ExpectedOutputRevision_technicalSourceId_idx" ON "ExpectedOutputRevision"("technicalSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpectedOutputRevision_goldenFixtureId_revisionNumber_key" ON "ExpectedOutputRevision"("goldenFixtureId", "revisionNumber");

-- CreateIndex
CREATE INDEX "GoldenFixtureRuleUsage_ruleRecordId_idx" ON "GoldenFixtureRuleUsage"("ruleRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenFixtureRuleUsage_goldenFixtureId_ruleRecordId_key" ON "GoldenFixtureRuleUsage"("goldenFixtureId", "ruleRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingTechnicalIssue_differenceId_key" ON "ManufacturingTechnicalIssue"("differenceId");

-- CreateIndex
CREATE INDEX "ManufacturingTechnicalIssue_fixtureId_status_idx" ON "ManufacturingTechnicalIssue"("fixtureId", "status");

-- CreateIndex
CREATE INDEX "ManufacturingTechnicalIssue_responsibleRuleId_idx" ON "ManufacturingTechnicalIssue"("responsibleRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenFixture_verifiedExpectedOutputRevisionId_key" ON "GoldenFixture"("verifiedExpectedOutputRevisionId");

-- CreateIndex
CREATE INDEX "TechnicalSource_ownerOrganizationId_reviewState_idx" ON "TechnicalSource"("ownerOrganizationId", "reviewState");

-- AddForeignKey
ALTER TABLE "GoldenFixture" ADD CONSTRAINT "GoldenFixture_verifiedExpectedOutputRevisionId_fkey" FOREIGN KEY ("verifiedExpectedOutputRevisionId") REFERENCES "ExpectedOutputRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationComparison" ADD CONSTRAINT "CalculationComparison_expectedOutputRevisionId_fkey" FOREIGN KEY ("expectedOutputRevisionId") REFERENCES "ExpectedOutputRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationDifference" ADD CONSTRAINT "CalculationDifference_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationDifference" ADD CONSTRAINT "CalculationDifference_responsibleRuleId_fkey" FOREIGN KEY ("responsibleRuleId") REFERENCES "ManufacturingRuleRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedOutputRevision" ADD CONSTRAINT "ExpectedOutputRevision_goldenFixtureId_fkey" FOREIGN KEY ("goldenFixtureId") REFERENCES "GoldenFixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedOutputRevision" ADD CONSTRAINT "ExpectedOutputRevision_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedOutputRevision" ADD CONSTRAINT "ExpectedOutputRevision_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenFixtureRuleUsage" ADD CONSTRAINT "GoldenFixtureRuleUsage_goldenFixtureId_fkey" FOREIGN KEY ("goldenFixtureId") REFERENCES "GoldenFixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenFixtureRuleUsage" ADD CONSTRAINT "GoldenFixtureRuleUsage_ruleRecordId_fkey" FOREIGN KEY ("ruleRecordId") REFERENCES "ManufacturingRuleRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingTechnicalIssue" ADD CONSTRAINT "ManufacturingTechnicalIssue_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "GoldenFixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingTechnicalIssue" ADD CONSTRAINT "ManufacturingTechnicalIssue_differenceId_fkey" FOREIGN KEY ("differenceId") REFERENCES "CalculationDifference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingTechnicalIssue" ADD CONSTRAINT "ManufacturingTechnicalIssue_responsibleRuleId_fkey" FOREIGN KEY ("responsibleRuleId") REFERENCES "ManufacturingRuleRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingTechnicalIssue" ADD CONSTRAINT "ManufacturingTechnicalIssue_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
