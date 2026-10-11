-- Durable editorial history and threaded review comments.
CREATE TYPE "EditorialCommentStatus" AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE "RecordVersion" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecordVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EditorialComment" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sectionKey" TEXT,
    "fieldKey" TEXT,
    "body" TEXT NOT NULL,
    "status" "EditorialCommentStatus" NOT NULL DEFAULT 'open',
    "isChangeRequest" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "EditorialComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecordVersion_targetType_targetId_version_key" ON "RecordVersion"("targetType", "targetId", "version");
CREATE INDEX "RecordVersion_targetType_targetId_createdAt_idx" ON "RecordVersion"("targetType", "targetId", "createdAt");
CREATE INDEX "EditorialComment_targetType_targetId_status_createdAt_idx" ON "EditorialComment"("targetType", "targetId", "status", "createdAt");
CREATE INDEX "EditorialComment_parentId_createdAt_idx" ON "EditorialComment"("parentId", "createdAt");

ALTER TABLE "RecordVersion" ADD CONSTRAINT "RecordVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialComment" ADD CONSTRAINT "EditorialComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EditorialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialComment" ADD CONSTRAINT "EditorialComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialComment" ADD CONSTRAINT "EditorialComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
