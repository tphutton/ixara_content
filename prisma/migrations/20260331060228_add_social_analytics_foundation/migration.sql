-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube', 'manual_import');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('pending_setup', 'active', 'needs_reauth', 'disconnected', 'error');

-- CreateEnum
CREATE TYPE "PublishedPostStatus" AS ENUM ('draft', 'published', 'failed', 'deleted', 'imported');

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'pending_setup',
    "accountName" TEXT NOT NULL,
    "accountHandle" TEXT,
    "externalAccountId" TEXT,
    "brandProfileId" TEXT,
    "brandName" TEXT,
    "region" TEXT,
    "country" TEXT,
    "scopes" TEXT[],
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedPost" (
    "id" TEXT NOT NULL,
    "connectedAccountId" TEXT,
    "contentId" TEXT,
    "blogId" TEXT,
    "scheduleId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "platformAccountName" TEXT,
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "titleSnapshot" TEXT,
    "captionSnapshot" TEXT,
    "mediaSnapshot" JSONB,
    "status" "PublishedPostStatus" NOT NULL DEFAULT 'imported',
    "publishedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "latestAnalyticsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "publishedPostId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER,
    "reach" INTEGER,
    "engagements" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "clicks" INTEGER,
    "videoViews" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "clickThroughRate" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectedAccount_status_platform_idx" ON "ConnectedAccount"("status", "platform");

-- CreateIndex
CREATE INDEX "ConnectedAccount_brandName_region_country_idx" ON "ConnectedAccount"("brandName", "region", "country");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_platform_externalAccountId_key" ON "ConnectedAccount"("platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "PublishedPost_connectedAccountId_publishedAt_idx" ON "PublishedPost"("connectedAccountId", "publishedAt");

-- CreateIndex
CREATE INDEX "PublishedPost_contentId_blogId_scheduleId_idx" ON "PublishedPost"("contentId", "blogId", "scheduleId");

-- CreateIndex
CREATE INDEX "PublishedPost_status_platform_publishedAt_idx" ON "PublishedPost"("status", "platform", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPost_platform_externalPostId_key" ON "PublishedPost"("platform", "externalPostId");

-- CreateIndex
CREATE INDEX "PostAnalyticsSnapshot_publishedPostId_capturedAt_idx" ON "PostAnalyticsSnapshot"("publishedPostId", "capturedAt");

-- CreateIndex
CREATE INDEX "PostAnalyticsSnapshot_capturedAt_idx" ON "PostAnalyticsSnapshot"("capturedAt");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "ConnectedAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ContentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedPost" ADD CONSTRAINT "PublishedPost_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAnalyticsSnapshot" ADD CONSTRAINT "PostAnalyticsSnapshot_publishedPostId_fkey" FOREIGN KEY ("publishedPostId") REFERENCES "PublishedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
