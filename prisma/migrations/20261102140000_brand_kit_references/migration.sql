CREATE TABLE "BrandKitReference" (
  "id" TEXT NOT NULL, "brandProfileId" TEXT NOT NULL, "assetId" TEXT NOT NULL,
  "role" TEXT NOT NULL, "notes" TEXT, "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandKitReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrandKitReference_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BrandKitReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BrandKitReference_brandProfileId_assetId_role_key" ON "BrandKitReference"("brandProfileId", "assetId", "role");
CREATE INDEX "BrandKitReference_brandProfileId_status_idx" ON "BrandKitReference"("brandProfileId", "status");
