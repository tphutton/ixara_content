-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('wordpress', 'manual');

-- AlterTable
ALTER TABLE "Blog" ADD COLUMN     "featureAssetId" TEXT;

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "primaryAssetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "source" "AssetSource" NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT,
    "mediaType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "altText" TEXT,
    "caption" TEXT,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "tags" TEXT[],
    "brand" TEXT,
    "campaignName" TEXT,
    "sport" TEXT,
    "region" TEXT,
    "country" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogAsset" (
    "id" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_fileUrl_key" ON "Asset"("fileUrl");

-- CreateIndex
CREATE INDEX "Asset_source_syncedAt_idx" ON "Asset"("source", "syncedAt");

-- CreateIndex
CREATE INDEX "Asset_brand_campaignName_sport_region_country_idx" ON "Asset"("brand", "campaignName", "sport", "region", "country");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_source_externalId_key" ON "Asset"("source", "externalId");

-- CreateIndex
CREATE INDEX "ContentAsset_assetId_idx" ON "ContentAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_contentId_assetId_key" ON "ContentAsset"("contentId", "assetId");

-- CreateIndex
CREATE INDEX "BlogAsset_assetId_idx" ON "BlogAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogAsset_blogId_slot_key" ON "BlogAsset"("blogId", "slot");

-- CreateIndex
CREATE INDEX "CampaignAsset_campaignId_idx" ON "CampaignAsset"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAsset_campaignId_assetId_key" ON "CampaignAsset"("campaignId", "assetId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_primaryAssetId_fkey" FOREIGN KEY ("primaryAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_featureAssetId_fkey" FOREIGN KEY ("featureAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogAsset" ADD CONSTRAINT "BlogAsset_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogAsset" ADD CONSTRAINT "BlogAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
