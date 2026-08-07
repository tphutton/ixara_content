-- CreateEnum
CREATE TYPE "QualityReviewTargetType" AS ENUM ('content', 'blog', 'content_plan_item');

-- CreateTable
CREATE TABLE "QualityReview" (
    "id" TEXT NOT NULL,
    "targetType" "QualityReviewTargetType" NOT NULL,
    "contentId" TEXT,
    "blogId" TEXT,
    "planItemId" TEXT,
    "overallScore" INTEGER NOT NULL,
    "brandScore" INTEGER NOT NULL,
    "audienceScore" INTEGER NOT NULL,
    "clarityScore" INTEGER NOT NULL,
    "channelScore" INTEGER NOT NULL,
    "conversionScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "issues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rewrittenHook" TEXT,
    "rewrittenCTA" TEXT,
    "model" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityReview_targetType_createdAt_idx" ON "QualityReview"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "QualityReview_contentId_createdAt_idx" ON "QualityReview"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "QualityReview_blogId_createdAt_idx" ON "QualityReview"("blogId", "createdAt");

-- CreateIndex
CREATE INDEX "QualityReview_planItemId_createdAt_idx" ON "QualityReview"("planItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "ContentPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReview" ADD CONSTRAINT "QualityReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
