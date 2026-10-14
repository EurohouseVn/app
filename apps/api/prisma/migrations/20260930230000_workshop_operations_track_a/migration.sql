-- CreateEnum
CREATE TYPE "SurveyMeasurementStatus" AS ENUM ('DRAFT', 'MEASURED', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "OperationsInventoryTransactionType" AS ENUM ('RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUST', 'RESERVE', 'UNRESERVE', 'RETURN', 'SCRAP');

-- CreateEnum
CREATE TYPE "OperationsReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OperationsRemnantStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CONSUMED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "WorkshopWorkOrderType" AS ENUM ('MEASUREMENT', 'MATERIAL_PREP', 'CUTTING', 'MACHINING', 'ASSEMBLY', 'GLAZING', 'QC', 'PACKING', 'DELIVERY', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "WorkshopWorkOrderStatus" AS ENUM ('DRAFT', 'READY', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkshopQcResult" AS ENUM ('PASS', 'FAIL', 'REWORK');

-- CreateEnum
CREATE TYPE "WorkshopInstallationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS', 'QC_PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkshopWarrantyAssetStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "WorkshopWarrantyTicketStatus" AS ENUM ('OPEN', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DomainEventOutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfflineMutationStatus" AS ENUM ('PENDING', 'APPLIED', 'CONFLICT', 'FAILED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "customerV2Id" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- Preserve tenant ownership for legacy projects. Rows whose owner has no
-- organization intentionally remain NULL and are excluded from Track A APIs.
UPDATE "Project" AS p
SET "organizationId" = u."organizationId"
FROM "User" AS u
WHERE p."ownerId" = u."id"
  AND u."organizationId" IS NOT NULL;

-- CreateTable
CREATE TABLE "WorkshopCustomer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "taxCode" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectZone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectSiteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopOpening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "zoneId" TEXT,
    "stableCode" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "wallThicknessMm" INTEGER,
    "sillLevelMm" INTEGER,
    "installationNotes" TEXT NOT NULL DEFAULT '',
    "measurementStatus" "SurveyMeasurementStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningMeasurement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "wallThicknessMm" INTEGER,
    "sillLevelMm" INTEGER,
    "status" "SurveyMeasurementStatus" NOT NULL DEFAULT 'MEASURED',
    "note" TEXT NOT NULL DEFAULT '',
    "measuredById" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopDoorRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "operationType" TEXT NOT NULL DEFAULT '',
    "leafCount" INTEGER,
    "glassIntent" TEXT NOT NULL DEFAULT '',
    "hardwareIntent" TEXT NOT NULL DEFAULT '',
    "colorIntent" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopDoorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSitePhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openingId" TEXT,
    "storageObjectId" TEXT,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopSitePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSiteNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openingId" TEXT,
    "noteType" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "voiceObjectId" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopSiteNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'VND',
    "defaultWarehouseId" TEXT,
    "quoteValidityDays" INTEGER NOT NULL DEFAULT 15,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 12,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTeam" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamType" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL DEFAULT '',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "WorkshopTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWarehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWarehouseLocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL DEFAULT 'RACK',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopMachine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "kerfMm" DOUBLE PRECISION,
    "minimumCutMm" INTEGER,
    "maximumStockMm" INTEGER,
    "angleCapabilities" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSupplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "leadTimeDays" INTEGER,
    "minimumOrder" DECIMAL(18,2),
    "paymentTerms" TEXT NOT NULL DEFAULT '',
    "deliveryNotes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopSupplierMaterial" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "referencePrice" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSupplierMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStockItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "materialRefType" TEXT NOT NULL DEFAULT 'MANUAL',
    "materialRefId" TEXT,
    "finishKey" TEXT NOT NULL DEFAULT '',
    "minimumLevel" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStockLot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "lotCode" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "supplierId" TEXT,
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "unitCost" DECIMAL(18,2),
    "attributes" JSONB,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopInventoryTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionType" "OperationsInventoryTransactionType" NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "adjustmentDelta" DECIMAL(18,3),
    "unit" TEXT NOT NULL,
    "fromWarehouseId" TEXT,
    "fromLocationId" TEXT,
    "toWarehouseId" TEXT,
    "toLocationId" TEXT,
    "reservationId" TEXT,
    "remnantId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopInventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopInventoryReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "consumedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" "OperationsReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reservedById" TEXT NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopInventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStockRemnant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "lotId" TEXT,
    "materialIdentity" TEXT NOT NULL,
    "finishKey" TEXT NOT NULL DEFAULT '',
    "lengthMm" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "rackLocation" TEXT NOT NULL DEFAULT '',
    "status" "OperationsRemnantStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sourceTransactionId" TEXT,
    "sourceCutPlanRef" TEXT,
    "reservedByRef" TEXT,
    "reservedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "consumedByTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopStockRemnant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQuickQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "methodLabel" TEXT NOT NULL DEFAULT 'COMMERCIAL_ESTIMATE',
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "priceBookVersionId" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopQuickQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQuickQuoteLine" (
    "id" TEXT NOT NULL,
    "quickQuoteId" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkshopQuickQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "customerId" TEXT,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "referenceType" TEXT NOT NULL DEFAULT '',
    "referenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "WorkshopWorkOrderType" NOT NULL,
    "status" "WorkshopWorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "openingId" TEXT,
    "assignedTeamId" TEXT,
    "assignedWorkerId" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "instructions" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWorkOrderHistory" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL,
    "issueCode" TEXT,
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopWorkOrderHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopPackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT,
    "workOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "itemRefs" JSONB,
    "sealedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopPackage_organizationId_code_key" ON "WorkshopPackage"("organizationId", "code");
CREATE INDEX "WorkshopPackage_organizationId_status_createdAt_idx" ON "WorkshopPackage"("organizationId", "status", "createdAt");
CREATE INDEX "WorkshopPackage_projectId_workOrderId_idx" ON "WorkshopPackage"("projectId", "workOrderId");

-- CreateTable
CREATE TABLE "WorkshopQrIdentity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopQrIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQcTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopQcTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQcTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkshopQcTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQcInspection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "installationId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "overallResult" "WorkshopQcResult",
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopQcInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopQcInspectionResult" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "result" "WorkshopQcResult" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "WorkshopQcInspectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopInstallationJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "vehicleRef" TEXT NOT NULL DEFAULT '',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "status" "WorkshopInstallationStatus" NOT NULL DEFAULT 'DRAFT',
    "openingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "materialsChecklist" JSONB,
    "toolsChecklist" JSONB,
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerSignatureObjectId" TEXT,
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopInstallationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWarrantyAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openingId" TEXT,
    "installationJobId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "installerTeamId" TEXT,
    "warrantyMonths" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkshopWarrantyAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "qrIdentityId" TEXT,
    "manufacturingBomRevisionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWarrantyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWarrantyTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "WorkshopWarrantyTicketStatus" NOT NULL DEFAULT 'OPEN',
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requestedById" TEXT NOT NULL,
    "assignedTeamId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWarrantyTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopWarrantyServiceEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "parts" JSONB,
    "photoObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopWarrantyServiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopDomainEventOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DomainEventOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopDomainEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopOfflineMutation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "operation" TEXT NOT NULL,
    "baseRevision" INTEGER,
    "payload" JSONB NOT NULL,
    "status" "OfflineMutationStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "conflict" JSONB,
    "actorId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopOfflineMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL,
    "referenceIds" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopCustomer_organizationId_name_idx" ON "WorkshopCustomer"("organizationId", "name");

-- CreateIndex
CREATE INDEX "WorkshopCustomer_organizationId_phone_idx" ON "WorkshopCustomer"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopCustomer_organizationId_code_key" ON "WorkshopCustomer"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ProjectSite_organizationId_projectId_idx" ON "ProjectSite"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSite_organizationId_code_key" ON "ProjectSite"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ProjectZone_organizationId_projectSiteId_idx" ON "ProjectZone"("organizationId", "projectSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectZone_projectSiteId_code_key" ON "ProjectZone"("projectSiteId", "code");

-- CreateIndex
CREATE INDEX "WorkshopOpening_organizationId_projectId_zoneId_idx" ON "WorkshopOpening"("organizationId", "projectId", "zoneId");

-- CreateIndex
CREATE INDEX "WorkshopOpening_organizationId_measurementStatus_idx" ON "WorkshopOpening"("organizationId", "measurementStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopOpening_organizationId_stableCode_key" ON "WorkshopOpening"("organizationId", "stableCode");

-- CreateIndex
CREATE INDEX "OpeningMeasurement_organizationId_openingId_measuredAt_idx" ON "OpeningMeasurement"("organizationId", "openingId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningMeasurement_openingId_revision_key" ON "OpeningMeasurement"("openingId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopDoorRequest_openingId_key" ON "WorkshopDoorRequest"("openingId");

-- CreateIndex
CREATE INDEX "WorkshopDoorRequest_organizationId_intentType_idx" ON "WorkshopDoorRequest"("organizationId", "intentType");

-- CreateIndex
CREATE INDEX "WorkshopSitePhoto_organizationId_projectId_openingId_idx" ON "WorkshopSitePhoto"("organizationId", "projectId", "openingId");

-- CreateIndex
CREATE INDEX "WorkshopSiteNote_organizationId_projectId_openingId_idx" ON "WorkshopSiteNote"("organizationId", "projectId", "openingId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSettings_organizationId_key" ON "WorkshopSettings"("organizationId");

-- CreateIndex
CREATE INDEX "WorkshopTeam_organizationId_active_idx" ON "WorkshopTeam"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTeam_organizationId_code_key" ON "WorkshopTeam"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopTeamMember_workerId_idx" ON "WorkshopTeamMember"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTeamMember_teamId_workerId_key" ON "WorkshopTeamMember"("teamId", "workerId");

-- CreateIndex
CREATE INDEX "WorkshopWarehouse_organizationId_active_idx" ON "WorkshopWarehouse"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopWarehouse_organizationId_code_key" ON "WorkshopWarehouse"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopWarehouseLocation_organizationId_warehouseId_idx" ON "WorkshopWarehouseLocation"("organizationId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopWarehouseLocation_warehouseId_code_key" ON "WorkshopWarehouseLocation"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "WorkshopMachine_organizationId_machineType_active_idx" ON "WorkshopMachine"("organizationId", "machineType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopMachine_organizationId_code_key" ON "WorkshopMachine"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopSupplier_organizationId_name_idx" ON "WorkshopSupplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSupplier_organizationId_code_key" ON "WorkshopSupplier"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSupplierMaterial_supplierId_materialKey_key" ON "WorkshopSupplierMaterial"("supplierId", "materialKey");

-- CreateIndex
CREATE INDEX "WorkshopStockItem_organizationId_category_active_idx" ON "WorkshopStockItem"("organizationId", "category", "active");

-- CreateIndex
CREATE INDEX "WorkshopStockItem_materialRefType_materialRefId_idx" ON "WorkshopStockItem"("materialRefType", "materialRefId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStockItem_organizationId_code_key" ON "WorkshopStockItem"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopStockLot_organizationId_stockItemId_warehouseId_loc_idx" ON "WorkshopStockLot"("organizationId", "stockItemId", "warehouseId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStockLot_organizationId_lotCode_key" ON "WorkshopStockLot"("organizationId", "lotCode");

-- CreateIndex
CREATE INDEX "WorkshopInventoryTransaction_organizationId_stockItemId_occ_idx" ON "WorkshopInventoryTransaction"("organizationId", "stockItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkshopInventoryTransaction_organizationId_lotId_occurredA_idx" ON "WorkshopInventoryTransaction"("organizationId", "lotId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkshopInventoryTransaction_sourceType_sourceId_idx" ON "WorkshopInventoryTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopInventoryTransaction_organizationId_idempotencyKey_key" ON "WorkshopInventoryTransaction"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkshopInventoryReservation_organizationId_stockItemId_sta_idx" ON "WorkshopInventoryReservation"("organizationId", "stockItemId", "status");

-- CreateIndex
CREATE INDEX "WorkshopInventoryReservation_organizationId_referenceType_r_idx" ON "WorkshopInventoryReservation"("organizationId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "WorkshopStockRemnant_organizationId_stockItemId_status_leng_idx" ON "WorkshopStockRemnant"("organizationId", "stockItemId", "status", "lengthMm");

-- CreateIndex
CREATE INDEX "WorkshopStockRemnant_organizationId_warehouseId_locationId_idx" ON "WorkshopStockRemnant"("organizationId", "warehouseId", "locationId");

-- CreateIndex
CREATE INDEX "WorkshopStockRemnant_reservedByRef_idx" ON "WorkshopStockRemnant"("reservedByRef");

-- CreateIndex
CREATE INDEX "WorkshopQuickQuote_organizationId_status_createdAt_idx" ON "WorkshopQuickQuote"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkshopQuickQuote_projectId_idx" ON "WorkshopQuickQuote"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQuickQuote_organizationId_code_key" ON "WorkshopQuickQuote"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopQuickQuoteLine_quickQuoteId_sortOrder_idx" ON "WorkshopQuickQuoteLine"("quickQuoteId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkshopActivity_organizationId_projectId_occurredAt_idx" ON "WorkshopActivity"("organizationId", "projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkshopActivity_organizationId_customerId_occurredAt_idx" ON "WorkshopActivity"("organizationId", "customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkshopWorkOrder_organizationId_status_scheduledStart_idx" ON "WorkshopWorkOrder"("organizationId", "status", "scheduledStart");

-- CreateIndex
CREATE INDEX "WorkshopWorkOrder_organizationId_assignedWorkerId_status_idx" ON "WorkshopWorkOrder"("organizationId", "assignedWorkerId", "status");

-- CreateIndex
CREATE INDEX "WorkshopWorkOrder_projectId_openingId_idx" ON "WorkshopWorkOrder"("projectId", "openingId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopWorkOrder_organizationId_code_key" ON "WorkshopWorkOrder"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopWorkOrderHistory_workOrderId_createdAt_idx" ON "WorkshopWorkOrderHistory"("workOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQrIdentity_publicId_key" ON "WorkshopQrIdentity"("publicId");

-- CreateIndex
CREATE INDEX "WorkshopQrIdentity_organizationId_active_idx" ON "WorkshopQrIdentity"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQrIdentity_organizationId_entityType_entityId_key" ON "WorkshopQrIdentity"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkshopQcTemplate_organizationId_appliesTo_active_idx" ON "WorkshopQcTemplate"("organizationId", "appliesTo", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQcTemplate_organizationId_code_version_key" ON "WorkshopQcTemplate"("organizationId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQcTemplateItem_templateId_checkKey_key" ON "WorkshopQcTemplateItem"("templateId", "checkKey");

-- CreateIndex
CREATE INDEX "WorkshopQcInspection_organizationId_entityType_entityId_idx" ON "WorkshopQcInspection"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkshopQcInspection_organizationId_status_createdAt_idx" ON "WorkshopQcInspection"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopQcInspectionResult_inspectionId_checkKey_key" ON "WorkshopQcInspectionResult"("inspectionId", "checkKey");

-- CreateIndex
CREATE INDEX "WorkshopInstallationJob_organizationId_status_scheduledStar_idx" ON "WorkshopInstallationJob"("organizationId", "status", "scheduledStart");

-- CreateIndex
CREATE INDEX "WorkshopInstallationJob_projectId_idx" ON "WorkshopInstallationJob"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopInstallationJob_organizationId_code_key" ON "WorkshopInstallationJob"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopWarrantyAsset_organizationId_status_expiresAt_idx" ON "WorkshopWarrantyAsset"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkshopWarrantyAsset_projectId_openingId_idx" ON "WorkshopWarrantyAsset"("projectId", "openingId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopWarrantyAsset_organizationId_assetCode_key" ON "WorkshopWarrantyAsset"("organizationId", "assetCode");

-- CreateIndex
CREATE INDEX "WorkshopWarrantyTicket_organizationId_status_createdAt_idx" ON "WorkshopWarrantyTicket"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkshopWarrantyTicket_assetId_idx" ON "WorkshopWarrantyTicket"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopWarrantyTicket_organizationId_code_key" ON "WorkshopWarrantyTicket"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkshopWarrantyServiceEvent_ticketId_occurredAt_idx" ON "WorkshopWarrantyServiceEvent"("ticketId", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkshopDomainEventOutbox_status_availableAt_idx" ON "WorkshopDomainEventOutbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "WorkshopDomainEventOutbox_organizationId_aggregateType_aggr_idx" ON "WorkshopDomainEventOutbox"("organizationId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "WorkshopOfflineMutation_organizationId_deviceId_status_crea_idx" ON "WorkshopOfflineMutation"("organizationId", "deviceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopOfflineMutation_organizationId_clientMutationId_key" ON "WorkshopOfflineMutation"("organizationId", "clientMutationId");

-- CreateIndex
CREATE INDEX "WorkshopAuditEvent_organizationId_entityType_entityId_creat_idx" ON "WorkshopAuditEvent"("organizationId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkshopAuditEvent_actorId_createdAt_idx" ON "WorkshopAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_organizationId_updatedAt_idx" ON "Project"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_customerV2Id_idx" ON "Project"("customerV2Id");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerV2Id_fkey" FOREIGN KEY ("customerV2Id") REFERENCES "WorkshopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSite" ADD CONSTRAINT "ProjectSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectZone" ADD CONSTRAINT "ProjectZone_projectSiteId_fkey" FOREIGN KEY ("projectSiteId") REFERENCES "ProjectSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopOpening" ADD CONSTRAINT "WorkshopOpening_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopOpening" ADD CONSTRAINT "WorkshopOpening_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ProjectZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningMeasurement" ADD CONSTRAINT "OpeningMeasurement_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "WorkshopOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopDoorRequest" ADD CONSTRAINT "WorkshopDoorRequest_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "WorkshopOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTeamMember" ADD CONSTRAINT "WorkshopTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorkshopTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWarehouseLocation" ADD CONSTRAINT "WorkshopWarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "WorkshopWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopSupplierMaterial" ADD CONSTRAINT "WorkshopSupplierMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "WorkshopSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStockLot" ADD CONSTRAINT "WorkshopStockLot_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "WorkshopStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInventoryReservation" ADD CONSTRAINT "WorkshopInventoryReservation_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "WorkshopStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStockRemnant" ADD CONSTRAINT "WorkshopStockRemnant_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "WorkshopStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopQuickQuote" ADD CONSTRAINT "WorkshopQuickQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopQuickQuoteLine" ADD CONSTRAINT "WorkshopQuickQuoteLine_quickQuoteId_fkey" FOREIGN KEY ("quickQuoteId") REFERENCES "WorkshopQuickQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopActivity" ADD CONSTRAINT "WorkshopActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWorkOrder" ADD CONSTRAINT "WorkshopWorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWorkOrderHistory" ADD CONSTRAINT "WorkshopWorkOrderHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkshopWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopQcTemplateItem" ADD CONSTRAINT "WorkshopQcTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkshopQcTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopQcInspectionResult" ADD CONSTRAINT "WorkshopQcInspectionResult_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "WorkshopQcInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInstallationJob" ADD CONSTRAINT "WorkshopInstallationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWarrantyAsset" ADD CONSTRAINT "WorkshopWarrantyAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWarrantyTicket" ADD CONSTRAINT "WorkshopWarrantyTicket_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "WorkshopWarrantyAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopWarrantyServiceEvent" ADD CONSTRAINT "WorkshopWarrantyServiceEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "WorkshopWarrantyTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
