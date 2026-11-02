CREATE TABLE "BrandCharacter" (
  "id" TEXT NOT NULL,
  "brandProfileId" TEXT NOT NULL,
  "referenceAssetId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "personality" TEXT NOT NULL,
  "voiceDescription" TEXT,
  "provider" TEXT,
  "providerCharacterId" TEXT,
  "providerVoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandCharacter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrandCharacter_brandProfileId_name_key" ON "BrandCharacter"("brandProfileId", "name");
CREATE INDEX "BrandCharacter_brandProfileId_idx" ON "BrandCharacter"("brandProfileId");
ALTER TABLE "BrandCharacter" ADD CONSTRAINT "BrandCharacter_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandCharacter" ADD CONSTRAINT "BrandCharacter_referenceAssetId_fkey" FOREIGN KEY ("referenceAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
