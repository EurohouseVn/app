-- Track B is additive: preserve the Track A operating data and legacy indexes.
CREATE TYPE "WorkshopMediaUploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'CANCELLED');
CREATE TYPE "WorkshopWorkspaceRole" AS ENUM ('OWNER', 'WORKSHOP_MANAGER', 'SUPERVISOR', 'WORKER', 'INSTALLER', 'ADMIN');

ALTER TYPE "DomainEventOutboxStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "DomainEventOutboxStatus" ADD VALUE 'DEAD_LETTER';

ALTER TABLE "WorkshopDomainEventOutbox"
  ADD COLUMN "lockToken" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "processingLatencyMs" INTEGER;

ALTER TABLE "WorkshopInstallationJob"
  ADD COLUMN "requiredPhotoCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requiredQcTemplateId" TEXT,
  ADD COLUMN "requiresCustomerSignature" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "WorkshopWarrantyTicket"
  ADD COLUMN "assignedTechnicianId" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "resolution" TEXT NOT NULL DEFAULT '';

CREATE TABLE "WorkshopPilotConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "survey" BOOLEAN NOT NULL DEFAULT false,
  "inventory" BOOLEAN NOT NULL DEFAULT false,
  "shopFloor" BOOLEAN NOT NULL DEFAULT false,
  "quality" BOOLEAN NOT NULL DEFAULT false,
  "installation" BOOLEAN NOT NULL DEFAULT false,
  "warranty" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "previousConfig" JSONB,
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkshopPilotConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopRoleAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "WorkshopWorkspaceRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkshopRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopMediaUpload" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "uploadState" "WorkshopMediaUploadStatus" NOT NULL DEFAULT 'PENDING',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT '',
  "storageObjectId" TEXT,
  "metadata" JSONB,
  "createdById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkshopMediaUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopEventConsumption" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "outboxId" TEXT NOT NULL,
  "consumerKey" TEXT NOT NULL,
  "sideEffectRef" TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkshopEventConsumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopTelemetryEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "deviceId" TEXT,
  "sessionId" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "durationMs" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkshopTelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopPilotConfig_organizationId_key" ON "WorkshopPilotConfig"("organizationId");
CREATE INDEX "WorkshopPilotConfig_active_updatedAt_idx" ON "WorkshopPilotConfig"("active", "updatedAt");
CREATE INDEX "WorkshopRoleAssignment_organizationId_role_active_idx" ON "WorkshopRoleAssignment"("organizationId", "role", "active");
CREATE UNIQUE INDEX "WorkshopRoleAssignment_organizationId_userId_key" ON "WorkshopRoleAssignment"("organizationId", "userId");
CREATE INDEX "WorkshopMediaUpload_organizationId_entityType_entityId_uploadState_idx" ON "WorkshopMediaUpload"("organizationId", "entityType", "entityId", "uploadState");
CREATE INDEX "WorkshopMediaUpload_organizationId_checksum_uploadState_idx" ON "WorkshopMediaUpload"("organizationId", "checksum", "uploadState");
CREATE UNIQUE INDEX "WorkshopMediaUpload_organizationId_deviceId_localId_key" ON "WorkshopMediaUpload"("organizationId", "deviceId", "localId");
CREATE INDEX "WorkshopEventConsumption_organizationId_processedAt_idx" ON "WorkshopEventConsumption"("organizationId", "processedAt");
CREATE UNIQUE INDEX "WorkshopEventConsumption_outboxId_consumerKey_key" ON "WorkshopEventConsumption"("outboxId", "consumerKey");
CREATE INDEX "WorkshopTelemetryEvent_organizationId_eventType_occurredAt_idx" ON "WorkshopTelemetryEvent"("organizationId", "eventType", "occurredAt");
CREATE INDEX "WorkshopTelemetryEvent_organizationId_actorId_occurredAt_idx" ON "WorkshopTelemetryEvent"("organizationId", "actorId", "occurredAt");
CREATE INDEX "WorkshopDomainEventOutbox_status_nextAttemptAt_idx" ON "WorkshopDomainEventOutbox"("status", "nextAttemptAt");
