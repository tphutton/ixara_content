-- CreateEnum
CREATE TYPE "AutomationType" AS ENUM ('weekly_social_content');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "AutomationFrequency" AS ENUM ('manual', 'weekly');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AutomationType" NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'draft',
    "frequency" "AutomationFrequency" NOT NULL DEFAULT 'weekly',
    "description" TEXT,
    "promptTemplate" TEXT,
    "brandProfileId" TEXT,
    "brandName" TEXT,
    "targetContentStatus" "ContentStatus" NOT NULL DEFAULT 'draft',
    "itemCount" INTEGER NOT NULL DEFAULT 5,
    "dayOfWeek" INTEGER,
    "runTime" TEXT,
    "timezone" TEXT,
    "channels" TEXT[],
    "platforms" TEXT[],
    "region" TEXT,
    "country" TEXT,
    "sport" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL,
    "summary" TEXT,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationWorkflow_status_nextRunAt_idx" ON "AutomationWorkflow"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_brandName_type_idx" ON "AutomationWorkflow"("brandName", "type");

-- CreateIndex
CREATE INDEX "AutomationRun_workflowId_startedAt_idx" ON "AutomationRun"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationRun_status_startedAt_idx" ON "AutomationRun"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
