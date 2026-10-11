-- Add structured video planning without changing existing content or asset records.
CREATE TYPE "VideoBriefStatus" AS ENUM ('draft', 'review', 'approved', 'generating', 'ready', 'rejected');
CREATE TYPE "VideoShotStatus" AS ENUM ('planned', 'approved', 'generating', 'ready', 'needs_changes');

ALTER TYPE "ContentPlanItemType" ADD VALUE 'video';

CREATE TABLE "VideoBrief" (
    "id" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "targetPlatforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "concept" TEXT NOT NULL,
    "script" TEXT,
    "voiceover" TEXT,
    "onScreenText" TEXT,
    "audioDirection" TEXT,
    "visualDirection" TEXT,
    "generationStrategy" TEXT,
    "status" "VideoBriefStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoShot" (
    "id" TEXT NOT NULL,
    "videoBriefId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "purpose" TEXT,
    "prompt" TEXT NOT NULL,
    "cameraDirection" TEXT,
    "visualDetails" TEXT,
    "referenceAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "onScreenText" TEXT,
    "voiceover" TEXT,
    "status" "VideoShotStatus" NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoShot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoBrief_planItemId_key" ON "VideoBrief"("planItemId");
CREATE INDEX "VideoBrief_status_updatedAt_idx" ON "VideoBrief"("status", "updatedAt");
CREATE UNIQUE INDEX "VideoShot_videoBriefId_sortOrder_key" ON "VideoShot"("videoBriefId", "sortOrder");
CREATE INDEX "VideoShot_videoBriefId_status_idx" ON "VideoShot"("videoBriefId", "status");

ALTER TABLE "VideoBrief" ADD CONSTRAINT "VideoBrief_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "ContentPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoBrief" ADD CONSTRAINT "VideoBrief_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoBrief" ADD CONSTRAINT "VideoBrief_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VideoShot" ADD CONSTRAINT "VideoShot_videoBriefId_fkey" FOREIGN KEY ("videoBriefId") REFERENCES "VideoBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
