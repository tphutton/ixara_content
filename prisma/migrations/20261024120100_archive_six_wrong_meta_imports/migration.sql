-- These are Ixara records imported from the wrong Meta identity, not Meta posts.
-- Archive full records and analytics first; never touch content, schedules or Meta.
BEGIN;
CREATE TABLE "SocialImportCleanupArchive" (
  "publishedPostId" TEXT PRIMARY KEY,
  "reason" TEXT NOT NULL,
  "post" JSONB NOT NULL,
  "analyticsSnapshots" JSONB NOT NULL,
  "archivedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TEMP TABLE cleanup_targets ON COMMIT DROP AS
SELECT p.* FROM "PublishedPost" p
JOIN (VALUES
  ('cmvm52ael0005r31x01xods1h','cmt001v130001paw9tsoce3q1','instagram','2021-06-05T10:53:35Z'),
  ('cmvm52apn0009r31xz06mj3pi','cmt001v130001paw9tsoce3q1','instagram','2021-04-18T06:56:23Z'),
  ('cmvm52b29000dr31xpfqosjn8','cmt001v130001paw9tsoce3q1','instagram','2021-01-01T04:59:50Z'),
  ('cmvm5ua530001pn1x0yv9pyu8','cmvm4ep790001r31x0rgpub05','facebook','2021-06-05T10:53:29Z'),
  ('cmvm5ua6u0005pn1xe5ogsgt5','cmvm4ep790001r31x0rgpub05','facebook','2021-04-18T06:56:18Z'),
  ('cmvm5ua7y0009pn1x20wv9g64','cmvm4ep790001r31x0rgpub05','facebook','2021-01-01T04:59:46Z')
) t(id, account_id, platform, published_at) ON p.id=t.id
WHERE p."connectedAccountId"=t.account_id AND p.platform::text=t.platform
  AND p."publishedAt"=t.published_at::timestamptz
  AND p."externalPostId" IS NOT NULL AND p."importedAt" IS NOT NULL
  AND p."contentId" IS NULL AND p."blogId" IS NULL AND p."scheduleId" IS NULL
  AND p."deliveryKey" IS NULL
  AND (p."captionSnapshot" ILIKE '%Sustainable Golf%'
    OR p."captionSnapshot" ILIKE '%greatest threat to our planet%');
INSERT INTO "SocialImportCleanupArchive" ("publishedPostId", "reason", "post", "analyticsSnapshots")
SELECT t.id, 'Sustainable Golf history imported through the former StadioMate connection', to_jsonb(t),
  COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM "PostAnalyticsSnapshot" s WHERE s."publishedPostId"=t.id), '[]'::jsonb)
FROM cleanup_targets t;
DELETE FROM "PublishedPost" p USING cleanup_targets t WHERE p.id=t.id;
COMMIT;
