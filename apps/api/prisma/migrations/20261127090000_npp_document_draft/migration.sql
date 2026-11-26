-- CreateTable
CREATE TABLE "NppDocumentDraft" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "imageObjectId" TEXT,
    "engine" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "lines" JSONB NOT NULL,
    "factoryOrgId" TEXT,
    "resultRef" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppDocumentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppOcrGlossary" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "profileId" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppOcrGlossary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NppDocumentDraft_nppOrgId_status_createdAt_idx" ON "NppDocumentDraft"("nppOrgId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NppOcrGlossary_nppOrgId_term_key" ON "NppOcrGlossary"("nppOrgId", "term");

-- AddForeignKey
ALTER TABLE "NppDocumentDraft" ADD CONSTRAINT "NppDocumentDraft_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppOcrGlossary" ADD CONSTRAINT "NppOcrGlossary_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
