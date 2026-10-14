-- CreateEnum
CREATE TYPE "TechnicalSourceType" AS ENUM ('OFFICIAL_CATALOGUE', 'TECHNICAL_DRAWING', 'TECHNICAL_BULLETIN', 'MANUFACTURING_STANDARD', 'ENGINEERING_CONFIRMATION', 'LEGACY_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "TechnicalReviewState" AS ENUM ('UNREVIEWED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "GoldenFixtureStatus" AS ENUM ('CANDIDATE', 'CALCULATED', 'TECHNICAL_REVIEW', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CalculationComparisonKind" AS ENUM ('LEGACY_V2', 'DESIGN_REVISION');

-- CreateEnum
CREATE TYPE "CalculationComparisonStatus" AS ENUM ('PENDING', 'MATCH', 'EXPLAINED_DIFFERENCE', 'UNEXPLAINED_DIFFERENCE', 'NOT_COMPARABLE');

-- CreateEnum
CREATE TYPE "DifferenceClassification" AS ENUM ('MATCH', 'EXPLAINED_DIFFERENCE', 'UNEXPLAINED_DIFFERENCE', 'NOT_COMPARABLE');

-- CreateEnum
CREATE TYPE "DifferenceReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BomRevisionStatus" ADD VALUE 'CALCULATED';
ALTER TYPE "BomRevisionStatus" ADD VALUE 'TECHNICAL_REVIEW';
ALTER TYPE "BomRevisionStatus" ADD VALUE 'APPROVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DatasetRevisionStatus" ADD VALUE 'REVIEW';
ALTER TYPE "DatasetRevisionStatus" ADD VALUE 'RELEASED';
ALTER TYPE "DatasetRevisionStatus" ADD VALUE 'RETIRED';

-- AlterTable
ALTER TABLE "BomRevision" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "releasedById" TEXT,
ADD COLUMN     "reviewNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "DatasetRevision" ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedById" TEXT,
ADD COLUMN     "reviewNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "validationHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "validationReport" JSONB;

-- CreateTable
CREATE TABLE "TechnicalSource" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT,
    "sourceType" "TechnicalSourceType" NOT NULL,
    "sourceDocument" TEXT NOT NULL,
    "sourceRevision" TEXT NOT NULL DEFAULT '',
    "sourcePage" TEXT NOT NULL DEFAULT '',
    "sourceFileObjectId" TEXT,
    "sourceHash" TEXT NOT NULL DEFAULT '',
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalSourceLink" (
    "id" TEXT NOT NULL,
    "technicalSourceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalSourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManufacturingRuleRecord" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT,
    "technicalSourceId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputSemantics" JSONB NOT NULL,
    "implementation" JSONB NOT NULL,
    "technicalJustification" TEXT NOT NULL DEFAULT '',
    "effectiveRevision" TEXT NOT NULL DEFAULT '',
    "reviewState" "TechnicalReviewState" NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManufacturingRuleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldenFixture" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT,
    "datasetRevisionId" TEXT,
    "technicalSourceId" TEXT,
    "doorWindowType" TEXT NOT NULL,
    "systemStableKey" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "openingTopology" JSONB NOT NULL,
    "referenceImageObjectId" TEXT,
    "profileRoleMapping" JSONB NOT NULL,
    "expectedProfileIdentities" JSONB NOT NULL,
    "expectedCuttingLengths" JSONB NOT NULL,
    "expectedCuttingAngles" JSONB NOT NULL,
    "expectedGlass" JSONB NOT NULL,
    "expectedGasket" JSONB NOT NULL,
    "expectedHardware" JSONB NOT NULL,
    "expectedAccessories" JSONB NOT NULL,
    "expectedBom" JSONB NOT NULL,
    "expectedCuttingRequirements" JSONB NOT NULL,
    "candidateDesign" JSONB NOT NULL,
    "actualOutput" JSONB,
    "ruleVersion" TEXT NOT NULL DEFAULT '',
    "engineVersion" TEXT NOT NULL DEFAULT '',
    "status" "GoldenFixtureStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewChecks" JSONB,
    "reviewerId" TEXT,
    "approvalTimestamp" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldenFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationComparison" (
    "id" TEXT NOT NULL,
    "kind" "CalculationComparisonKind" NOT NULL,
    "fixtureId" TEXT,
    "leftTraceId" TEXT,
    "rightTraceId" TEXT,
    "leftLabel" TEXT NOT NULL,
    "rightLabel" TEXT NOT NULL,
    "leftOutput" JSONB NOT NULL,
    "rightOutput" JSONB NOT NULL,
    "status" "CalculationComparisonStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationDifference" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "legacyValue" JSONB,
    "v2Value" JSONB,
    "delta" JSONB,
    "classification" "DifferenceClassification" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "reviewStatus" "DifferenceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationDifference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalReviewEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicalSource_datasetRevisionId_idx" ON "TechnicalSource"("datasetRevisionId");

-- CreateIndex
CREATE INDEX "TechnicalSource_sourceType_idx" ON "TechnicalSource"("sourceType");

-- CreateIndex
CREATE INDEX "TechnicalSource_sourceHash_idx" ON "TechnicalSource"("sourceHash");

-- CreateIndex
CREATE INDEX "TechnicalSourceLink_entityType_entityId_idx" ON "TechnicalSourceLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalSourceLink_technicalSourceId_entityType_entityId_f_key" ON "TechnicalSourceLink"("technicalSourceId", "entityType", "entityId", "fieldPath");

-- CreateIndex
CREATE INDEX "ManufacturingRuleRecord_datasetRevisionId_idx" ON "ManufacturingRuleRecord"("datasetRevisionId");

-- CreateIndex
CREATE INDEX "ManufacturingRuleRecord_reviewState_idx" ON "ManufacturingRuleRecord"("reviewState");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingRuleRecord_ruleId_ruleVersion_key" ON "ManufacturingRuleRecord"("ruleId", "ruleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenFixture_fixtureId_key" ON "GoldenFixture"("fixtureId");

-- CreateIndex
CREATE INDEX "GoldenFixture_status_idx" ON "GoldenFixture"("status");

-- CreateIndex
CREATE INDEX "GoldenFixture_datasetRevisionId_idx" ON "GoldenFixture"("datasetRevisionId");

-- CreateIndex
CREATE INDEX "GoldenFixture_systemStableKey_idx" ON "GoldenFixture"("systemStableKey");

-- CreateIndex
CREATE INDEX "CalculationComparison_fixtureId_idx" ON "CalculationComparison"("fixtureId");

-- CreateIndex
CREATE INDEX "CalculationComparison_kind_status_idx" ON "CalculationComparison"("kind", "status");

-- CreateIndex
CREATE INDEX "CalculationDifference_comparisonId_classification_idx" ON "CalculationDifference"("comparisonId", "classification");

-- CreateIndex
CREATE INDEX "CalculationDifference_reviewStatus_idx" ON "CalculationDifference"("reviewStatus");

-- CreateIndex
CREATE INDEX "TechnicalReviewEvent_entityType_entityId_createdAt_idx" ON "TechnicalReviewEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "TechnicalReviewEvent_actorId_createdAt_idx" ON "TechnicalReviewEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "TechnicalSource" ADD CONSTRAINT "TechnicalSource_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalSourceLink" ADD CONSTRAINT "TechnicalSourceLink_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingRuleRecord" ADD CONSTRAINT "ManufacturingRuleRecord_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManufacturingRuleRecord" ADD CONSTRAINT "ManufacturingRuleRecord_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenFixture" ADD CONSTRAINT "GoldenFixture_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenFixture" ADD CONSTRAINT "GoldenFixture_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldenFixture" ADD CONSTRAINT "GoldenFixture_technicalSourceId_fkey" FOREIGN KEY ("technicalSourceId") REFERENCES "TechnicalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationComparison" ADD CONSTRAINT "CalculationComparison_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "GoldenFixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationComparison" ADD CONSTRAINT "CalculationComparison_leftTraceId_fkey" FOREIGN KEY ("leftTraceId") REFERENCES "CalculationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationComparison" ADD CONSTRAINT "CalculationComparison_rightTraceId_fkey" FOREIGN KEY ("rightTraceId") REFERENCES "CalculationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationDifference" ADD CONSTRAINT "CalculationDifference_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "CalculationComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
