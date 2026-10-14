-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('FULL_BAR', 'DE_XE');

-- CreateEnum
CREATE TYPE "AudienceTarget" AS ENUM ('WORKER', 'NPP_DEALER', 'ALL');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('PRODUCT_INFO', 'CONSTRUCTION_GUIDE', 'CUTTING_GUIDE', 'CREATIVE_GUIDE');

-- CreateEnum
CREATE TYPE "LibraryCategory" AS ENUM ('PROJECT_IMAGE', 'DOOR_SAMPLE', 'SHORT_VIDEO');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- DropIndex
DROP INDEX "Order_factoryOrgId_idx";

-- DropIndex
DROP INDEX "QuotationItem_quotationId_idx";

-- AlterTable
ALTER TABLE "LibraryItem" DROP COLUMN "imageUrl",
DROP COLUMN "tag",
DROP COLUMN "type",
DROP COLUMN "videoUrl",
ADD COLUMN     "categoryId" "LibraryCategory" NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "mediaType" "MediaType" NOT NULL,
ADD COLUMN     "mediaUrl" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "email" TEXT,
ADD COLUMN     "fanpage" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "mainCategories" TEXT,
ADD COLUMN     "productionName" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "purchasingPower" TEXT,
ADD COLUMN     "targetRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tier" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "costConsumables" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costInstallation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costTransport" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "debtAccessory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "debtCustomer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "debtGlass" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "debtNpp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "debtOther" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "estimatedValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "incurredType" TEXT NOT NULL DEFAULT 'INCREASE',
ADD COLUMN     "incurredValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "potentialRating" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productsUsed" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quotationId" TEXT,
ADD COLUMN     "scale" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "settledValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "targetAudience" "AudienceTarget" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "aluPricePerKg",
DROP COLUMN "doorType",
DROP COLUMN "glassPerM2",
DROP COLUMN "heightMm",
DROP COLUMN "pricePerM2",
DROP COLUMN "quantity",
DROP COLUMN "widthMm";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managedProvinces" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "rbacRoleId" TEXT,
ADD COLUMN     "scrapKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Warranty" ADD COLUMN     "customerAddress" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "WorkshopAttendance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkshopReminder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkshopWorker" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileCutoff" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileCutoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "currentBrand" TEXT NOT NULL DEFAULT '',
    "scale" TEXT NOT NULL DEFAULT '',
    "potentialRating" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "managedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReport" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL DEFAULT 0,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "deductions" INTEGER NOT NULL DEFAULT 0,
    "netPay" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Die" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "profileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalExtrusions" INTEGER NOT NULL DEFAULT 0,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maintenanceAlert" INTEGER NOT NULL DEFAULT 500,
    "location" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Die_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" TEXT,
    "profileId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL DEFAULT '',
    "targetKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scrapKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dieId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStep" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scrapKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "machineCode" TEXT NOT NULL DEFAULT '',
    "workerName" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AluminumPrice" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "retailPrice" DOUBLE PRECISION NOT NULL,
    "dealerPrice" DOUBLE PRECISION NOT NULL,
    "nppPrice" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AluminumPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoorModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingFormula" (
    "id" TEXT NOT NULL,
    "doorModelId" TEXT NOT NULL,
    "aluSystem" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "lengthFormula" TEXT NOT NULL,
    "widthFormula" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cutAngle" TEXT NOT NULL DEFAULT '90-90',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuttingFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAccessoryPrice" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAccessoryPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "type" "InventoryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "numericId" INTEGER NOT NULL,
    "systemName" TEXT NOT NULL,
    "windowTypeName" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "variantCount" INTEGER NOT NULL DEFAULT 0,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemFormula" (
    "id" TEXT NOT NULL,
    "aluSystemId" TEXT NOT NULL,
    "doorModelId" TEXT NOT NULL,
    "excelFilePath" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "categoryId" "KnowledgeCategory" NOT NULL,
    "aluSystemId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "ProfileCutoff_profileId_idx" ON "ProfileCutoff"("profileId");

-- CreateIndex
CREATE INDEX "ProfileCutoff_createdById_idx" ON "ProfileCutoff"("createdById");

-- CreateIndex
CREATE INDEX "Lead_managedById_idx" ON "Lead"("managedById");

-- CreateIndex
CREATE INDEX "Lead_province_idx" ON "Lead"("province");

-- CreateIndex
CREATE INDEX "SaleReport_createdById_idx" ON "SaleReport"("createdById");

-- CreateIndex
CREATE INDEX "SaleReport_date_idx" ON "SaleReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_nppOrgId_year_month_key" ON "SalesTarget"("nppOrgId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_userId_month_key" ON "Payroll"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Die_code_key" ON "Die"("code");

-- CreateIndex
CREATE INDEX "Die_profileId_idx" ON "Die"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_code_key" ON "WorkOrder"("code");

-- CreateIndex
CREATE INDEX "WorkOrder_orderId_idx" ON "WorkOrder"("orderId");

-- CreateIndex
CREATE INDEX "WorkOrder_profileId_idx" ON "WorkOrder"("profileId");

-- CreateIndex
CREATE INDEX "WorkOrder_dieId_idx" ON "WorkOrder"("dieId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderStep_workOrderId_stepName_key" ON "WorkOrderStep"("workOrderId", "stepName");

-- CreateIndex
CREATE INDEX "CuttingFormula_doorModelId_idx" ON "CuttingFormula"("doorModelId");

-- CreateIndex
CREATE INDEX "WorkerAccessoryPrice_workerId_idx" ON "WorkerAccessoryPrice"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "FormulaTemplate_templateId_key" ON "FormulaTemplate"("templateId");

-- CreateIndex
CREATE INDEX "FormulaTemplate_systemName_idx" ON "FormulaTemplate"("systemName");

-- CreateIndex
CREATE INDEX "FormulaTemplate_windowTypeName_idx" ON "FormulaTemplate"("windowTypeName");

-- CreateIndex
CREATE UNIQUE INDEX "SystemFormula_aluSystemId_doorModelId_key" ON "SystemFormula"("aluSystemId", "doorModelId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rbacRoleId_fkey" FOREIGN KEY ("rbacRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_factoryOrgId_fkey" FOREIGN KEY ("factoryOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCutoff" ADD CONSTRAINT "ProfileCutoff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileCutoff" ADD CONSTRAINT "ProfileCutoff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReport" ADD CONSTRAINT "SaleReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Die" ADD CONSTRAINT "Die_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_dieId_fkey" FOREIGN KEY ("dieId") REFERENCES "Die"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStep" ADD CONSTRAINT "WorkOrderStep_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingFormula" ADD CONSTRAINT "CuttingFormula_doorModelId_fkey" FOREIGN KEY ("doorModelId") REFERENCES "DoorModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAccessoryPrice" ADD CONSTRAINT "WorkerAccessoryPrice_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemFormula" ADD CONSTRAINT "SystemFormula_aluSystemId_fkey" FOREIGN KEY ("aluSystemId") REFERENCES "AluSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemFormula" ADD CONSTRAINT "SystemFormula_doorModelId_fkey" FOREIGN KEY ("doorModelId") REFERENCES "DoorModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_aluSystemId_fkey" FOREIGN KEY ("aluSystemId") REFERENCES "AluSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
