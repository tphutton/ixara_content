ALTER TABLE "PublishedPost" ADD COLUMN "sourceExternalAccountId" TEXT, ADD COLUMN "sourceBrandName" TEXT;
ALTER TABLE "PostAnalyticsSnapshot" ADD COLUMN "views" INTEGER;

-- Backfill only history synced after the user explicitly confirmed this identity.
-- Earlier imports cannot safely be attributed using today's connection.
UPDATE "PublishedPost" p
SET "sourceExternalAccountId" = a."externalAccountId",
    "sourceBrandName" = COALESCE(b."brandName", a."brandName")
FROM "ConnectedAccount" a LEFT JOIN "BrandProfile" b ON b.id = a."brandProfileId"
WHERE p."connectedAccountId" = a.id AND a."externalAccountId" IS NOT NULL
  AND a.metadata->>'metaConfirmedAt' IS NOT NULL
  AND p."importedAt" >= (a.metadata->>'metaConfirmedAt')::timestamptz;
