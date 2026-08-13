-- CreateEnum
CREATE TYPE "ContentPlanStatus" AS ENUM ('draft', 'review', 'approved', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ContentPlanItemType" AS ENUM ('content', 'blog', 'schedule', 'asset_request', 'automation');

-- CreateEnum
CREATE TYPE "ContentPlanItemStatus" AS ENUM ('planned', 'approved', 'created', 'scheduled', 'published', 'blocked', 'cancelled');

-- CreateTable
CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "status" "ContentPlanStatus" NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "brand" TEXT,
    "campaignName" TEXT,
    "sourcePrompt" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "itemType" "ContentPlanItemType" NOT NULL,
    "status" "ContentPlanItemStatus" NOT NULL DEFAULT 'planned',
    "title" TEXT NOT NULL,
    "brief" TEXT,
    "channel" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "brand" TEXT,
    "sport" TEXT,
    "region" TEXT,
    "country" TEXT,
    "campaignName" TEXT,
    "contentId" TEXT,
    "blogId" TEXT,
    "scheduleId" TEXT,
    "assetRequest" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentPlan_status_startDate_idx" ON "ContentPlan"("status", "startDate");

-- CreateIndex
CREATE INDEX "ContentPlan_brand_campaignName_idx" ON "ContentPlan"("brand", "campaignName");

-- CreateIndex
CREATE INDEX "ContentPlanItem_planId_sortOrder_idx" ON "ContentPlanItem"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "ContentPlanItem_status_scheduledFor_idx" ON "ContentPlanItem"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ContentPlanItem_contentId_idx" ON "ContentPlanItem"("contentId");

-- CreateIndex
CREATE INDEX "ContentPlanItem_blogId_idx" ON "ContentPlanItem"("blogId");

-- CreateIndex
CREATE INDEX "ContentPlanItem_scheduleId_idx" ON "ContentPlanItem"("scheduleId");

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ContentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
