CREATE TABLE "McpChangeSet" (
 "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
 "requestHash" TEXT NOT NULL, "tool" TEXT NOT NULL, "argsJson" JSONB NOT NULL,
 "baseJson" JSONB NOT NULL, "previewJson" JSONB NOT NULL, "resultJson" JSONB,
 "expiresAt" TIMESTAMP(3) NOT NULL, "appliedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "McpChangeSet_actorId_requestKey_key" ON "McpChangeSet"("actorId", "requestKey");
CREATE INDEX "McpChangeSet_expiresAt_idx" ON "McpChangeSet"("expiresAt");
