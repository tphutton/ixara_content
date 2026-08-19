ALTER TYPE "AssetSource" ADD VALUE IF NOT EXISTS 'tsadb';

ALTER TABLE "Asset"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "itemName" TEXT,
  ADD COLUMN IF NOT EXISTS "itemId" TEXT,
  ADD COLUMN IF NOT EXISTS "itemType" TEXT,
  ADD COLUMN IF NOT EXISTS "imageType" TEXT,
  ADD COLUMN IF NOT EXISTS "wordpressAttachmentId" INTEGER,
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "orientation" TEXT,
  ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Asset_category_itemType_imageType_idx" ON "Asset"("category", "itemType", "imageType");
CREATE INDEX IF NOT EXISTS "Asset_wordpressAttachmentId_idx" ON "Asset"("wordpressAttachmentId");
CREATE INDEX IF NOT EXISTS "Asset_featured_idx" ON "Asset"("featured");
