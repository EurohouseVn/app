ALTER TABLE "WebsiteContentRevision"
  ADD COLUMN "technicalRiskHash" VARCHAR(64),
  ADD COLUMN "technicalApprovalSourceRevisionId" TEXT;

ALTER TABLE "WebsiteMediaAsset"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "WebsiteMediaAsset_archivedAt_idx" ON "WebsiteMediaAsset"("archivedAt");
