ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Project_organizationId_updatedAt_idx";
CREATE INDEX "Project_organizationId_archivedAt_updatedAt_idx"
ON "Project"("organizationId", "archivedAt", "updatedAt");
