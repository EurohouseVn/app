CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "FormulaAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "FormulaAccessSource" AS ENUM ('NPP_INVITE', 'NPP_DIRECT', 'ADMIN_DIRECT', 'MIGRATED');
CREATE TYPE "FormulaInviteStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE "FormulaAccessAction" AS ENUM ('INVITE_CREATED', 'INVITE_REDEEMED', 'DIRECT_ACTIVATED', 'REVOKED', 'NPP_TRANSFERRED');

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User"
  ADD COLUMN "emailNormalized" TEXT,
  ADD COLUMN "phoneNormalized" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationChannel" "VerificationChannel";

UPDATE "User"
SET "emailNormalized" = lower(btrim("email"))
WHERE "email" IS NOT NULL AND btrim("email") <> '';

UPDATE "User"
SET "verifiedAt" = "createdAt",
    "verificationChannel" = CASE WHEN "email" IS NOT NULL THEN 'EMAIL'::"VerificationChannel" ELSE 'PHONE'::"VerificationChannel" END;

UPDATE "User"
SET "phoneNormalized" = CASE
  WHEN regexp_replace("phone", '[^0-9+]', '', 'g') ~ '^0[35789][0-9]{8}$'
    THEN '+84' || substring(regexp_replace("phone", '[^0-9+]', '', 'g') FROM 2)
  WHEN regexp_replace("phone", '[^0-9+]', '', 'g') ~ '^84[35789][0-9]{8}$'
    THEN '+' || regexp_replace("phone", '[^0-9+]', '', 'g')
  WHEN regexp_replace("phone", '[^0-9+]', '', 'g') ~ '^\+84[35789][0-9]{8}$'
    THEN regexp_replace("phone", '[^0-9+]', '', 'g')
  ELSE NULL
END
WHERE "phone" IS NOT NULL;

CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

CREATE TABLE "VerificationChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "VerificationChannel" NOT NULL,
  "targetNormalized" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormulaAccessGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "FormulaAccessStatus" NOT NULL,
  "nppOrganizationId" TEXT,
  "source" "FormulaAccessSource" NOT NULL,
  "activatedByUserId" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FormulaAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormulaInvite" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codePrefix" TEXT NOT NULL,
  "codeLast4" TEXT NOT NULL,
  "nppOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" "FormulaInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "usedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "FormulaInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormulaAccessAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" "FormulaAccessAction" NOT NULL,
  "fromNppOrganizationId" TEXT,
  "toNppOrganizationId" TEXT,
  "formulaInviteId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormulaAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationChallenge_userId_createdAt_idx" ON "VerificationChallenge"("userId", "createdAt");
CREATE INDEX "VerificationChallenge_targetNormalized_idx" ON "VerificationChallenge"("targetNormalized");
CREATE UNIQUE INDEX "FormulaAccessGrant_organizationId_key" ON "FormulaAccessGrant"("organizationId");
CREATE INDEX "FormulaAccessGrant_nppOrganizationId_status_idx" ON "FormulaAccessGrant"("nppOrganizationId", "status");
CREATE UNIQUE INDEX "FormulaInvite_codeHash_key" ON "FormulaInvite"("codeHash");
CREATE INDEX "FormulaInvite_nppOrganizationId_status_idx" ON "FormulaInvite"("nppOrganizationId", "status");
CREATE INDEX "FormulaInvite_targetOrganizationId_status_idx" ON "FormulaInvite"("targetOrganizationId", "status");
CREATE INDEX "FormulaAccessAudit_organizationId_createdAt_idx" ON "FormulaAccessAudit"("organizationId", "createdAt");
CREATE INDEX "FormulaAccessAudit_actorUserId_createdAt_idx" ON "FormulaAccessAudit"("actorUserId", "createdAt");

ALTER TABLE "VerificationChallenge" ADD CONSTRAINT "VerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessGrant" ADD CONSTRAINT "FormulaAccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessGrant" ADD CONSTRAINT "FormulaAccessGrant_nppOrganizationId_fkey" FOREIGN KEY ("nppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessGrant" ADD CONSTRAINT "FormulaAccessGrant_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessGrant" ADD CONSTRAINT "FormulaAccessGrant_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaInvite" ADD CONSTRAINT "FormulaInvite_nppOrganizationId_fkey" FOREIGN KEY ("nppOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormulaInvite" ADD CONSTRAINT "FormulaInvite_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormulaInvite" ADD CONSTRAINT "FormulaInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormulaInvite" ADD CONSTRAINT "FormulaInvite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessAudit" ADD CONSTRAINT "FormulaAccessAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessAudit" ADD CONSTRAINT "FormulaAccessAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessAudit" ADD CONSTRAINT "FormulaAccessAudit_fromNppOrganizationId_fkey" FOREIGN KEY ("fromNppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessAudit" ADD CONSTRAINT "FormulaAccessAudit_toNppOrganizationId_fkey" FOREIGN KEY ("toNppOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormulaAccessAudit" ADD CONSTRAINT "FormulaAccessAudit_formulaInviteId_fkey" FOREIGN KEY ("formulaInviteId") REFERENCES "FormulaInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
