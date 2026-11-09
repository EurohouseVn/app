CREATE TYPE "EurohouseFeatureKey" AS ENUM ('FORMULA_CUTTING', 'EUROHOUSE_ORDERING');
CREATE TYPE "EurohouseAccessStatus" AS ENUM ('LOCKED', 'ACTIVE', 'REVOKED');
CREATE TYPE "EurohouseAccessSource" AS ENUM ('NPP_INVITE', 'NPP_DIRECT', 'ADMIN_DIRECT', 'MIGRATED');
CREATE TYPE "EurohouseInviteStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE "EurohouseAccessAction" AS ENUM ('INVITE_CREATED', 'INVITE_REDEEMED', 'DIRECT_ACTIVATED', 'REVOKED', 'NPP_TRANSFERRED');

CREATE TABLE "EurohouseFeatureGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "featureKey" "EurohouseFeatureKey" NOT NULL,
  "status" "EurohouseAccessStatus" NOT NULL,
  "nppOrganizationId" TEXT,
  "source" "EurohouseAccessSource" NOT NULL,
  "activatedByUserId" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EurohouseFeatureGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EurohouseInvite" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codePrefix" TEXT NOT NULL,
  "codeLast4" TEXT NOT NULL,
  "featureKeys" "EurohouseFeatureKey"[] NOT NULL,
  "nppOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" "EurohouseInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "EurohouseInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EurohouseAccessAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "featureKey" "EurohouseFeatureKey",
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" "EurohouseAccessAction" NOT NULL,
  "fromNppOrganizationId" TEXT,
  "toNppOrganizationId" TEXT,
  "eurohouseInviteId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EurohouseAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EurohouseFeatureGrant_organizationId_featureKey_key" ON "EurohouseFeatureGrant"("organizationId", "featureKey");
CREATE INDEX "EurohouseFeatureGrant_nppOrganizationId_featureKey_status_idx" ON "EurohouseFeatureGrant"("nppOrganizationId", "featureKey", "status");
CREATE UNIQUE INDEX "EurohouseInvite_codeHash_key" ON "EurohouseInvite"("codeHash");
CREATE INDEX "EurohouseInvite_nppOrganizationId_status_idx" ON "EurohouseInvite"("nppOrganizationId", "status");
CREATE INDEX "EurohouseInvite_targetOrganizationId_status_idx" ON "EurohouseInvite"("targetOrganizationId", "status");
CREATE INDEX "EurohouseAccessAudit_organizationId_createdAt_idx" ON "EurohouseAccessAudit"("organizationId", "createdAt");
CREATE INDEX "EurohouseAccessAudit_actorUserId_createdAt_idx" ON "EurohouseAccessAudit"("actorUserId", "createdAt");
CREATE INDEX "EurohouseAccessAudit_featureKey_createdAt_idx" ON "EurohouseAccessAudit"("featureKey", "createdAt");

ALTER TABLE "EurohouseFeatureGrant" ADD CONSTRAINT "EurohouseFeatureGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EurohouseFeatureGrant" ADD CONSTRAINT "EurohouseFeatureGrant_nppOrganizationId_fkey" FOREIGN KEY ("nppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EurohouseFeatureGrant" ADD CONSTRAINT "EurohouseFeatureGrant_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EurohouseFeatureGrant" ADD CONSTRAINT "EurohouseFeatureGrant_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EurohouseInvite" ADD CONSTRAINT "EurohouseInvite_nppOrganizationId_fkey" FOREIGN KEY ("nppOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EurohouseInvite" ADD CONSTRAINT "EurohouseInvite_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EurohouseInvite" ADD CONSTRAINT "EurohouseInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EurohouseInvite" ADD CONSTRAINT "EurohouseInvite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EurohouseAccessAudit" ADD CONSTRAINT "EurohouseAccessAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EurohouseAccessAudit" ADD CONSTRAINT "EurohouseAccessAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EurohouseAccessAudit" ADD CONSTRAINT "EurohouseAccessAudit_fromNppOrganizationId_fkey" FOREIGN KEY ("fromNppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EurohouseAccessAudit" ADD CONSTRAINT "EurohouseAccessAudit_toNppOrganizationId_fkey" FOREIGN KEY ("toNppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EurohouseAccessAudit" ADD CONSTRAINT "EurohouseAccessAudit_eurohouseInviteId_fkey" FOREIGN KEY ("eurohouseInviteId") REFERENCES "EurohouseInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EurohouseFeatureGrant" (
  "id", "organizationId", "featureKey", "status", "nppOrganizationId", "source",
  "activatedByUserId", "activatedAt", "revokedByUserId", "revokedAt", "revokeReason",
  "createdAt", "updatedAt"
)
SELECT
  "id", "organizationId", 'FORMULA_CUTTING'::"EurohouseFeatureKey",
  "status"::text::"EurohouseAccessStatus", "nppOrganizationId",
  "source"::text::"EurohouseAccessSource", "activatedByUserId", "activatedAt",
  "revokedByUserId", "revokedAt", "revokeReason", "createdAt", "updatedAt"
FROM "FormulaAccessGrant"
ON CONFLICT DO NOTHING;

INSERT INTO "EurohouseInvite" (
  "id", "codeHash", "codePrefix", "codeLast4", "featureKeys", "nppOrganizationId",
  "targetOrganizationId", "createdByUserId", "status", "expiresAt", "usedAt",
  "usedByUserId", "createdAt", "revokedAt"
)
SELECT
  "id", "codeHash", "codePrefix", "codeLast4",
  ARRAY['FORMULA_CUTTING'::"EurohouseFeatureKey"], "nppOrganizationId",
  "targetOrganizationId", "createdByUserId", "status"::text::"EurohouseInviteStatus",
  "expiresAt", "usedAt", "usedByUserId", "createdAt", "revokedAt"
FROM "FormulaInvite"
ON CONFLICT DO NOTHING;

INSERT INTO "EurohouseAccessAudit" (
  "id", "organizationId", "featureKey", "actorUserId", "actorRole", "action",
  "fromNppOrganizationId", "toNppOrganizationId", "eurohouseInviteId", "metadata", "createdAt"
)
SELECT
  "id", "organizationId", 'FORMULA_CUTTING'::"EurohouseFeatureKey", "actorUserId",
  "actorRole", "action"::text::"EurohouseAccessAction", "fromNppOrganizationId",
  "toNppOrganizationId", "formulaInviteId", "metadata", "createdAt"
FROM "FormulaAccessAudit"
ON CONFLICT DO NOTHING;
