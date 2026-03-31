-- AlterTable
ALTER TABLE "Blog"
ADD COLUMN "legacyExternalId" INTEGER,
ADD COLUMN "legacyBlogId" TEXT,
ADD COLUMN "legacyZohoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Blog_legacyExternalId_key" ON "Blog"("legacyExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "Blog_legacyBlogId_key" ON "Blog"("legacyBlogId");

-- CreateIndex
CREATE INDEX "Blog_legacyZohoId_idx" ON "Blog"("legacyZohoId");
