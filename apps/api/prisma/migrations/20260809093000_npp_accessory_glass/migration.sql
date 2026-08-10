CREATE TABLE "NppAccessory" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'cai',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppAccessory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NppGlassSheet" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "glassType" TEXT NOT NULL DEFAULT '',
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppGlassSheet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NppAccessory_nppOrgId_idx" ON "NppAccessory"("nppOrgId");
CREATE INDEX "NppAccessory_category_idx" ON "NppAccessory"("category");
CREATE INDEX "NppAccessory_brand_idx" ON "NppAccessory"("brand");
CREATE INDEX "NppGlassSheet_nppOrgId_idx" ON "NppGlassSheet"("nppOrgId");
CREATE INDEX "NppGlassSheet_glassType_idx" ON "NppGlassSheet"("glassType");

ALTER TABLE "NppAccessory" ADD CONSTRAINT "NppAccessory_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NppGlassSheet" ADD CONSTRAINT "NppGlassSheet_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
