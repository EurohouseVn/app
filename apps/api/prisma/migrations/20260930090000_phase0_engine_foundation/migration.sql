-- CreateEnum
CREATE TYPE "DatasetVerificationStatus" AS ENUM ('VERIFIED', 'COMMUNITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DatasetRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DoorDesignRevisionStatus" AS ENUM ('DRAFT', 'RELEASED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BomRevisionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'RELEASED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BomMaterialCategory" AS ENUM ('ALUMINIUM', 'GLASS', 'HARDWARE', 'GASKET', 'FASTENER', 'SEALANT', 'ACCESSORY', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceBookVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "StockRemnantStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CONSUMED', 'SCRAPPED');

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialDataset" (
    "id" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "ownerOrganizationId" TEXT,
    "verificationStatus" "DatasetVerificationStatus" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRevision" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "versionTag" TEXT NOT NULL,
    "status" "DatasetRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT NOT NULL DEFAULT '',
    "provenance" JSONB,
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AluminiumSystemV2" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacyAluSystemId" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AluminiumSystemV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRevision" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "aluminiumSystemId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stockLengthMm" INTEGER NOT NULL,
    "kgPerMeter" DOUBLE PRECISION NOT NULL,
    "thicknessMm" TEXT,
    "legacyProfileId" TEXT,
    "technicalData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileRoleMapping" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "aluminiumSystemId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "attributes" JSONB,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileRoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompatibilityRule" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "aluminiumSystemId" TEXT,
    "ruleType" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetHardwareItem" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetHardwareItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetGasketItem" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetGasketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetGlassRule" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "glassType" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetGlassRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishCompatibility" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "finishKey" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "compatible" BOOLEAN NOT NULL DEFAULT true,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinishCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyRule" (
    "id" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorDesign" (
    "id" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoorDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorDesignRevision" (
    "id" TEXT NOT NULL,
    "doorDesignId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "DoorDesignRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "openingType" TEXT NOT NULL,
    "leafCount" INTEGER NOT NULL DEFAULT 1,
    "handing" TEXT NOT NULL DEFAULT 'NONE',
    "openingDirection" TEXT NOT NULL DEFAULT 'NONE',
    "constraints" JSONB,
    "source" JSONB,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoorDesignRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignOpening" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignPanel" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "openingId" TEXT,
    "parentPanelId" TEXT,
    "componentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignMember" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignConnection" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "fromComponentId" TEXT NOT NULL,
    "toComponentId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignGlazingPanel" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "panelId" TEXT,
    "componentId" TEXT NOT NULL,
    "glassIntent" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignGlazingPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignHardwareRequirement" (
    "id" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "attributes" JSONB,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignHardwareRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationTrace" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "datasetRevisionId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "rulePackVersion" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "warnings" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculationTraceStep" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "sourceRule" TEXT,
    "input" JSONB,
    "output" JSONB,
    "diagnostics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationTraceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "doorDesignRevisionId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomRevision" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "BomRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "datasetRevisionId" TEXT NOT NULL,
    "calculationTraceId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "rulePackVersion" TEXT NOT NULL,
    "priceBookVersion" TEXT,
    "lineage" JSONB NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL,
    "bomRevisionId" TEXT NOT NULL,
    "category" "BomMaterialCategory" NOT NULL,
    "roleCode" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "profileRevisionId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "lengthMm" DOUBLE PRECISION,
    "widthMm" DOUBLE PRECISION,
    "heightMm" DOUBLE PRECISION,
    "attributes" JSONB,
    "constraints" JSONB,
    "sourceRule" TEXT,
    "trace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBook" (
    "id" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerOrganizationId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookVersion" (
    "id" TEXT NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionTag" TEXT NOT NULL,
    "status" "PriceBookVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL DEFAULT '',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceBookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceItem" (
    "id" TEXT NOT NULL,
    "priceBookVersionId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "supplierKey" TEXT,
    "customerTier" TEXT,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRemnant" (
    "id" TEXT NOT NULL,
    "profileRevisionId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT NOT NULL,
    "warehouseRef" TEXT NOT NULL,
    "rackLocation" TEXT NOT NULL DEFAULT '',
    "finishKey" TEXT NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "status" "StockRemnantStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sourceCutPlanRef" TEXT,
    "reservedByRef" TEXT,
    "reservedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockRemnant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageObject" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "ownerOrganizationId" TEXT,
    "ownerUserId" TEXT,
    "purpose" TEXT NOT NULL,
    "metadata" JSONB,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCommand" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_code_key" ON "Manufacturer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDataset_stableKey_key" ON "MaterialDataset"("stableKey");

-- CreateIndex
CREATE INDEX "MaterialDataset_manufacturerId_idx" ON "MaterialDataset"("manufacturerId");

-- CreateIndex
CREATE INDEX "MaterialDataset_ownerOrganizationId_idx" ON "MaterialDataset"("ownerOrganizationId");

-- CreateIndex
CREATE INDEX "DatasetRevision_status_idx" ON "DatasetRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRevision_datasetId_revisionNumber_key" ON "DatasetRevision"("datasetId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRevision_datasetId_versionTag_key" ON "DatasetRevision"("datasetId", "versionTag");

-- CreateIndex
CREATE INDEX "AluminiumSystemV2_legacyAluSystemId_idx" ON "AluminiumSystemV2"("legacyAluSystemId");

-- CreateIndex
CREATE UNIQUE INDEX "AluminiumSystemV2_datasetRevisionId_stableKey_key" ON "AluminiumSystemV2"("datasetRevisionId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "AluminiumSystemV2_datasetRevisionId_code_key" ON "AluminiumSystemV2"("datasetRevisionId", "code");

-- CreateIndex
CREATE INDEX "ProfileRevision_legacyProfileId_idx" ON "ProfileRevision"("legacyProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRevision_datasetRevisionId_stableKey_key" ON "ProfileRevision"("datasetRevisionId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRevision_aluminiumSystemId_code_key" ON "ProfileRevision"("aluminiumSystemId", "code");

-- CreateIndex
CREATE INDEX "ProfileRoleMapping_aluminiumSystemId_roleCode_idx" ON "ProfileRoleMapping"("aluminiumSystemId", "roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileRoleMapping_datasetRevisionId_aluminiumSystemId_role_key" ON "ProfileRoleMapping"("datasetRevisionId", "aluminiumSystemId", "roleCode", "profileRevisionId");

-- CreateIndex
CREATE INDEX "CompatibilityRule_aluminiumSystemId_active_idx" ON "CompatibilityRule"("aluminiumSystemId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CompatibilityRule_datasetRevisionId_ruleKey_key" ON "CompatibilityRule"("datasetRevisionId", "ruleKey");

-- CreateIndex
CREATE INDEX "DatasetHardwareItem_roleCode_idx" ON "DatasetHardwareItem"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetHardwareItem_datasetRevisionId_stableKey_key" ON "DatasetHardwareItem"("datasetRevisionId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetGasketItem_datasetRevisionId_stableKey_key" ON "DatasetGasketItem"("datasetRevisionId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetGlassRule_datasetRevisionId_ruleKey_key" ON "DatasetGlassRule"("datasetRevisionId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinishCompatibility_datasetRevisionId_finishKey_materialKey_key" ON "FinishCompatibility"("datasetRevisionId", "finishKey", "materialKey");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyRule_datasetRevisionId_ruleKey_key" ON "AssemblyRule"("datasetRevisionId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDesign_stableKey_key" ON "DoorDesign"("stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDesign_code_key" ON "DoorDesign"("code");

-- CreateIndex
CREATE INDEX "DoorDesign_ownerOrganizationId_idx" ON "DoorDesign"("ownerOrganizationId");

-- CreateIndex
CREATE INDEX "DoorDesignRevision_status_idx" ON "DoorDesignRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DoorDesignRevision_doorDesignId_revisionNumber_key" ON "DoorDesignRevision"("doorDesignId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DesignOpening_doorDesignRevisionId_componentId_key" ON "DesignOpening"("doorDesignRevisionId", "componentId");

-- CreateIndex
CREATE INDEX "DesignPanel_openingId_idx" ON "DesignPanel"("openingId");

-- CreateIndex
CREATE INDEX "DesignPanel_parentPanelId_idx" ON "DesignPanel"("parentPanelId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignPanel_doorDesignRevisionId_componentId_key" ON "DesignPanel"("doorDesignRevisionId", "componentId");

-- CreateIndex
CREATE INDEX "DesignMember_roleCode_idx" ON "DesignMember"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "DesignMember_doorDesignRevisionId_componentId_key" ON "DesignMember"("doorDesignRevisionId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignConnection_doorDesignRevisionId_componentId_key" ON "DesignConnection"("doorDesignRevisionId", "componentId");

-- CreateIndex
CREATE INDEX "DesignGlazingPanel_panelId_idx" ON "DesignGlazingPanel"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignGlazingPanel_doorDesignRevisionId_componentId_key" ON "DesignGlazingPanel"("doorDesignRevisionId", "componentId");

-- CreateIndex
CREATE INDEX "DesignHardwareRequirement_roleCode_idx" ON "DesignHardwareRequirement"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "DesignHardwareRequirement_doorDesignRevisionId_componentId__key" ON "DesignHardwareRequirement"("doorDesignRevisionId", "componentId", "roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "CalculationTrace_executionId_key" ON "CalculationTrace"("executionId");

-- CreateIndex
CREATE INDEX "CalculationTrace_doorDesignRevisionId_idx" ON "CalculationTrace"("doorDesignRevisionId");

-- CreateIndex
CREATE INDEX "CalculationTrace_datasetRevisionId_idx" ON "CalculationTrace"("datasetRevisionId");

-- CreateIndex
CREATE INDEX "CalculationTrace_completedAt_idx" ON "CalculationTrace"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalculationTraceStep_traceId_sequence_key" ON "CalculationTraceStep"("traceId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_stableKey_key" ON "Bom"("stableKey");

-- CreateIndex
CREATE INDEX "Bom_doorDesignRevisionId_idx" ON "Bom"("doorDesignRevisionId");

-- CreateIndex
CREATE INDEX "Bom_ownerOrganizationId_idx" ON "Bom"("ownerOrganizationId");

-- CreateIndex
CREATE INDEX "BomRevision_status_idx" ON "BomRevision"("status");

-- CreateIndex
CREATE INDEX "BomRevision_datasetRevisionId_idx" ON "BomRevision"("datasetRevisionId");

-- CreateIndex
CREATE INDEX "BomRevision_calculationTraceId_idx" ON "BomRevision"("calculationTraceId");

-- CreateIndex
CREATE UNIQUE INDEX "BomRevision_bomId_revisionNumber_key" ON "BomRevision"("bomId", "revisionNumber");

-- CreateIndex
CREATE INDEX "BomItem_bomRevisionId_category_idx" ON "BomItem"("bomRevisionId", "category");

-- CreateIndex
CREATE INDEX "BomItem_profileRevisionId_idx" ON "BomItem"("profileRevisionId");

-- CreateIndex
CREATE INDEX "BomItem_roleCode_idx" ON "BomItem"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBook_stableKey_key" ON "PriceBook"("stableKey");

-- CreateIndex
CREATE INDEX "PriceBook_ownerOrganizationId_idx" ON "PriceBook"("ownerOrganizationId");

-- CreateIndex
CREATE INDEX "PriceBookVersion_status_idx" ON "PriceBookVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookVersion_priceBookId_versionNumber_key" ON "PriceBookVersion"("priceBookId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookVersion_priceBookId_versionTag_key" ON "PriceBookVersion"("priceBookId", "versionTag");

-- CreateIndex
CREATE INDEX "PriceItem_itemType_itemKey_idx" ON "PriceItem"("itemType", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "PriceItem_priceBookVersionId_itemType_itemKey_supplierKey_c_key" ON "PriceItem"("priceBookVersionId", "itemType", "itemKey", "supplierKey", "customerTier");

-- CreateIndex
CREATE INDEX "StockRemnant_ownerOrganizationId_warehouseRef_status_idx" ON "StockRemnant"("ownerOrganizationId", "warehouseRef", "status");

-- CreateIndex
CREATE INDEX "StockRemnant_profileRevisionId_finishKey_lengthMm_idx" ON "StockRemnant"("profileRevisionId", "finishKey", "lengthMm");

-- CreateIndex
CREATE INDEX "StockRemnant_reservedByRef_idx" ON "StockRemnant"("reservedByRef");

-- CreateIndex
CREATE UNIQUE INDEX "StorageObject_objectKey_key" ON "StorageObject"("objectKey");

-- CreateIndex
CREATE INDEX "StorageObject_sha256_idx" ON "StorageObject"("sha256");

-- CreateIndex
CREATE INDEX "StorageObject_ownerOrganizationId_purpose_idx" ON "StorageObject"("ownerOrganizationId", "purpose");

-- CreateIndex
CREATE INDEX "InventoryCommand_actorId_createdAt_idx" ON "InventoryCommand"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryCommand_organizationId_createdAt_idx" ON "InventoryCommand"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryCommand_status_createdAt_idx" ON "InventoryCommand"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCommand_ownerType_ownerId_command_idempotencyKey_key" ON "InventoryCommand"("ownerType", "ownerId", "command", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "MaterialDataset" ADD CONSTRAINT "MaterialDataset_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRevision" ADD CONSTRAINT "DatasetRevision_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "MaterialDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AluminiumSystemV2" ADD CONSTRAINT "AluminiumSystemV2_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRevision" ADD CONSTRAINT "ProfileRevision_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRevision" ADD CONSTRAINT "ProfileRevision_aluminiumSystemId_fkey" FOREIGN KEY ("aluminiumSystemId") REFERENCES "AluminiumSystemV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRoleMapping" ADD CONSTRAINT "ProfileRoleMapping_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRoleMapping" ADD CONSTRAINT "ProfileRoleMapping_aluminiumSystemId_fkey" FOREIGN KEY ("aluminiumSystemId") REFERENCES "AluminiumSystemV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileRoleMapping" ADD CONSTRAINT "ProfileRoleMapping_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "ProfileRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompatibilityRule" ADD CONSTRAINT "CompatibilityRule_aluminiumSystemId_fkey" FOREIGN KEY ("aluminiumSystemId") REFERENCES "AluminiumSystemV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetHardwareItem" ADD CONSTRAINT "DatasetHardwareItem_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetGasketItem" ADD CONSTRAINT "DatasetGasketItem_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetGlassRule" ADD CONSTRAINT "DatasetGlassRule_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishCompatibility" ADD CONSTRAINT "FinishCompatibility_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyRule" ADD CONSTRAINT "AssemblyRule_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorDesignRevision" ADD CONSTRAINT "DoorDesignRevision_doorDesignId_fkey" FOREIGN KEY ("doorDesignId") REFERENCES "DoorDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignOpening" ADD CONSTRAINT "DesignOpening_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPanel" ADD CONSTRAINT "DesignPanel_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPanel" ADD CONSTRAINT "DesignPanel_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "DesignOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignPanel" ADD CONSTRAINT "DesignPanel_parentPanelId_fkey" FOREIGN KEY ("parentPanelId") REFERENCES "DesignPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignMember" ADD CONSTRAINT "DesignMember_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignConnection" ADD CONSTRAINT "DesignConnection_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignGlazingPanel" ADD CONSTRAINT "DesignGlazingPanel_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignGlazingPanel" ADD CONSTRAINT "DesignGlazingPanel_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "DesignPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignHardwareRequirement" ADD CONSTRAINT "DesignHardwareRequirement_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationTrace" ADD CONSTRAINT "CalculationTrace_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationTrace" ADD CONSTRAINT "CalculationTrace_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculationTraceStep" ADD CONSTRAINT "CalculationTraceStep_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "CalculationTrace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_doorDesignRevisionId_fkey" FOREIGN KEY ("doorDesignRevisionId") REFERENCES "DoorDesignRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevision" ADD CONSTRAINT "BomRevision_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevision" ADD CONSTRAINT "BomRevision_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRevision" ADD CONSTRAINT "BomRevision_calculationTraceId_fkey" FOREIGN KEY ("calculationTraceId") REFERENCES "CalculationTrace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_bomRevisionId_fkey" FOREIGN KEY ("bomRevisionId") REFERENCES "BomRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookVersion" ADD CONSTRAINT "PriceBookVersion_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceItem" ADD CONSTRAINT "PriceItem_priceBookVersionId_fkey" FOREIGN KEY ("priceBookVersionId") REFERENCES "PriceBookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRemnant" ADD CONSTRAINT "StockRemnant_profileRevisionId_fkey" FOREIGN KEY ("profileRevisionId") REFERENCES "ProfileRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
