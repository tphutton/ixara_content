-- Additive source-record storage for preserving every upstream image identity.
-- This migration does not update or delete existing Asset rows.
CREATE TABLE "AssetSourceRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "source" "AssetSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "description" TEXT,
    "itemName" TEXT,
    "itemId" TEXT,
    "itemType" TEXT,
    "category" TEXT,
    "region" TEXT,
    "country" TEXT,
    "imageType" TEXT,
    "ownerId" TEXT,
    "facilityId" TEXT,
    "wordpressAttachmentId" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetSourceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetSourceRecord_source_externalId_key"
ON "AssetSourceRecord"("source", "externalId");

CREATE INDEX "AssetSourceRecord_assetId_idx" ON "AssetSourceRecord"("assetId");
CREATE INDEX "AssetSourceRecord_itemId_idx" ON "AssetSourceRecord"("itemId");
CREATE INDEX "AssetSourceRecord_region_country_category_idx"
ON "AssetSourceRecord"("region", "country", "category");
CREATE INDEX "AssetSourceRecord_wordpressAttachmentId_idx"
ON "AssetSourceRecord"("wordpressAttachmentId");

ALTER TABLE "AssetSourceRecord"
ADD CONSTRAINT "AssetSourceRecord_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
