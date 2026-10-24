\set ON_ERROR_STOP on
-- Disposable CI database only. Test exact-ID cleanup, archival and keep conditions.
-- Recreate the pre-migration columns on this empty test database, then exercise
-- identity backfill on both sides of the explicit confirmation timestamp.
ALTER TABLE "PublishedPost" DROP COLUMN "sourceExternalAccountId", DROP COLUMN "sourceBrandName";
ALTER TABLE "PostAnalyticsSnapshot" DROP COLUMN "views";
INSERT INTO "ConnectedAccount" (id, platform, "accountName", scopes, "updatedAt", "externalAccountId", "brandName", metadata) VALUES
 ('identity-fixture', 'facebook', 'StadioMate', '{}', now(), 'correct-page', 'StadioMate', '{"metaConfirmedAt":"2026-10-24T10:00:00Z"}');
INSERT INTO "PublishedPost" (id, "connectedAccountId", platform, "importedAt", "updatedAt") VALUES
 ('identity-before', 'identity-fixture', 'facebook', '2026-10-24T09:00:00Z', now()),
 ('identity-after', 'identity-fixture', 'facebook', '2026-10-24T11:00:00Z', now());
\ir ../prisma/migrations/20261024120000_preserve_social_import_identity/migration.sql
DO $$ BEGIN
  IF (SELECT "sourceExternalAccountId" FROM "PublishedPost" WHERE id='identity-before') IS NOT NULL THEN RAISE EXCEPTION 'Backfill relabelled older history'; END IF;
  IF (SELECT "sourceExternalAccountId" FROM "PublishedPost" WHERE id='identity-after') <> 'correct-page' THEN RAISE EXCEPTION 'Identity backfill failed'; END IF;
  IF (SELECT "sourceBrandName" FROM "PublishedPost" WHERE id='identity-after') <> 'StadioMate' THEN RAISE EXCEPTION 'Brand backfill failed'; END IF;
END $$;
DELETE FROM "PublishedPost" WHERE id IN ('identity-before','identity-after');
DELETE FROM "ConnectedAccount" WHERE id='identity-fixture';

INSERT INTO "ConnectedAccount" (id, platform, "accountName", scopes, "updatedAt") VALUES
 ('cmt001v130001paw9tsoce3q1', 'instagram', 'StadioMate', '{}', now());
INSERT INTO "PublishedPost" (id, "connectedAccountId", platform, "externalPostId", "captionSnapshot", "publishedAt", "importedAt", "updatedAt") VALUES
 ('cmvm52ael0005r31x01xods1h', 'cmt001v130001paw9tsoce3q1', 'instagram', 'wrong-provider-post', 'The greatest threat to our planet is the belief that someone else will save it', '2021-06-05T10:53:35Z', now(), now()),
 ('cmvm52apn0009r31xz06mj3pi', 'cmt001v130001paw9tsoce3q1', 'instagram', 'changed-provider-post', 'StadioMate legitimate history', '2021-04-18T06:56:23Z', now(), now()),
 ('keep-stadiomate', 'cmt001v130001paw9tsoce3q1', 'instagram', 'correct-provider-post', 'Tee Time Saver rebrand', '2021-06-05T10:53:35Z', now(), now());
INSERT INTO "PostAnalyticsSnapshot" (id, "publishedPostId", engagements) VALUES ('cleanup-metrics', 'cmvm52ael0005r31x01xods1h', 42);
\ir ../prisma/migrations/20261024120100_archive_six_wrong_meta_imports/migration.sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PublishedPost" WHERE id='cmvm52ael0005r31x01xods1h') THEN RAISE EXCEPTION 'Wrong import remained'; END IF;
  IF EXISTS (SELECT 1 FROM "PostAnalyticsSnapshot" WHERE id='cleanup-metrics') THEN RAISE EXCEPTION 'Analytics did not cascade'; END IF;
  IF (SELECT count(*) FROM "SocialImportCleanupArchive") <> 1 THEN RAISE EXCEPTION 'Archive count incorrect'; END IF;
  IF (SELECT "analyticsSnapshots"->0->>'engagements' FROM "SocialImportCleanupArchive") <> '42' THEN RAISE EXCEPTION 'Archive lost analytics'; END IF;
  IF (SELECT count(*) FROM "PublishedPost" WHERE id IN ('keep-stadiomate','cmvm52apn0009r31xz06mj3pi')) <> 2 THEN RAISE EXCEPTION 'Unrelated/changed records deleted'; END IF;
END $$;
DELETE FROM "PublishedPost" WHERE id IN ('keep-stadiomate','cmvm52apn0009r31xz06mj3pi');
DELETE FROM "ConnectedAccount" WHERE id='cmt001v130001paw9tsoce3q1';
