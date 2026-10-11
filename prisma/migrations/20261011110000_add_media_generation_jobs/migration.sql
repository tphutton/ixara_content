-- Provider-neutral queue for external media generation and owned output reconciliation.
CREATE TYPE "MediaGenerationStatus" AS ENUM ('queued', 'submitted', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE "MediaGenerationJob" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" "MediaGenerationStatus" NOT NULL DEFAULT 'queued',
    "externalTaskId" TEXT,
    "outputAssetId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER,
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaGenerationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MediaGenerationJob_status_updatedAt_idx" ON "MediaGenerationJob"("status", "updatedAt");
CREATE INDEX "MediaGenerationJob_provider_targetType_targetId_idx" ON "MediaGenerationJob"("provider", "targetType", "targetId");
CREATE INDEX "MediaGenerationJob_externalTaskId_idx" ON "MediaGenerationJob"("externalTaskId");

ALTER TABLE "MediaGenerationJob" ADD CONSTRAINT "MediaGenerationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaGenerationJob" ADD CONSTRAINT "MediaGenerationJob_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
