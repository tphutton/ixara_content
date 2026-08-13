-- CreateTable
CREATE TABLE "ContentVariant" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "hook" TEXT,
    "body" TEXT,
    "cta" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "sourcePrompt" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentVariant_contentId_platform_idx" ON "ContentVariant"("contentId", "platform");

-- CreateIndex
CREATE INDEX "ContentVariant_status_platform_idx" ON "ContentVariant"("status", "platform");

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
