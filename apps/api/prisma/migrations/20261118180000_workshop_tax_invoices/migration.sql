-- CreateTable
CREATE TABLE "WorkshopTaxProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'HKD',
    "taxCode" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "legalAddress" TEXT NOT NULL DEFAULT '',
    "locationCode" TEXT NOT NULL DEFAULT '',
    "businessLine" TEXT NOT NULL DEFAULT 'MANUFACTURING',
    "vatRatePct" DOUBLE PRECISION,
    "pitRatePct" DOUBLE PRECISION,
    "pitMethod" TEXT NOT NULL DEFAULT 'REVENUE_RATE',
    "invoiceSeries" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "einvoiceRegisteredAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopTaxProfile_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "WorkshopSalesInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "projectCode" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT,
    "buyerName" TEXT NOT NULL DEFAULT '',
    "buyerTaxCode" TEXT NOT NULL DEFAULT '',
    "buyerAddress" TEXT NOT NULL DEFAULT '',
    "buyerEmail" TEXT NOT NULL DEFAULT '',
    "buyerPhone" TEXT NOT NULL DEFAULT '',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "series" TEXT NOT NULL DEFAULT '',
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'PROVIDER',
    "provider" TEXT,
    "providerRef" TEXT,
    "lookupCode" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "vatRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "replacesId" TEXT,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopSalesInvoice_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "WorkshopSalesInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkshopSalesInvoiceLine_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "WorkshopSalesInvoiceEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopSalesInvoiceEvent_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTaxProfile_organizationId_key" ON "WorkshopTaxProfile"("organizationId");


-- CreateIndex
CREATE INDEX "WorkshopSalesInvoice_organizationId_issueDate_idx" ON "WorkshopSalesInvoice"("organizationId", "issueDate");


-- CreateIndex
CREATE INDEX "WorkshopSalesInvoice_organizationId_status_idx" ON "WorkshopSalesInvoice"("organizationId", "status");


-- CreateIndex
CREATE UNIQUE INDEX "WorkshopSalesInvoice_organizationId_series_number_key" ON "WorkshopSalesInvoice"("organizationId", "series", "number");


-- CreateIndex
CREATE INDEX "WorkshopSalesInvoiceLine_invoiceId_position_idx" ON "WorkshopSalesInvoiceLine"("invoiceId", "position");


-- CreateIndex
CREATE INDEX "WorkshopSalesInvoiceEvent_invoiceId_createdAt_idx" ON "WorkshopSalesInvoiceEvent"("invoiceId", "createdAt");


-- AddForeignKey
ALTER TABLE "WorkshopTaxProfile" ADD CONSTRAINT "WorkshopTaxProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "WorkshopSalesInvoice" ADD CONSTRAINT "WorkshopSalesInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "WorkshopSalesInvoice" ADD CONSTRAINT "WorkshopSalesInvoice_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "WorkshopSalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "WorkshopSalesInvoiceLine" ADD CONSTRAINT "WorkshopSalesInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WorkshopSalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "WorkshopSalesInvoiceEvent" ADD CONSTRAINT "WorkshopSalesInvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "WorkshopSalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

