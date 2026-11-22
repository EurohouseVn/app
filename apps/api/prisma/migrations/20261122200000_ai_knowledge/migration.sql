-- CreateTable
CREATE TABLE "AiKnowledge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiKnowledge_key_key" ON "AiKnowledge"("key");

-- CreateIndex
CREATE INDEX "AiKnowledge_status_priority_idx" ON "AiKnowledge"("status", "priority");
