-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('idea', 'draft', 'approved', 'scheduled', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('social_post', 'caption', 'ad_copy', 'newsletter', 'video_script', 'campaign_copy', 'promo_copy');

-- CreateEnum
CREATE TYPE "BlogStatus" AS ENUM ('idea', 'draft', 'review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('planned', 'ready', 'scheduled', 'published', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant', 'tool', 'system');

-- CreateTable
CREATE TABLE "UserAccess" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "hook" TEXT,
    "cta" TEXT,
    "contentType" "ContentType" NOT NULL,
    "platform" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'idea',
    "campaignName" TEXT,
    "brand" TEXT,
    "sport" TEXT,
    "region" TEXT,
    "country" TEXT,
    "tags" TEXT[],
    "targetAudience" TEXT,
    "tone" TEXT,
    "websites" TEXT[],
    "assetImage" TEXT,
    "assetCaption" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourcePrompt" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "postDate" TIMESTAMP(3),
    "authorName" TEXT,
    "authorImage" TEXT,
    "featureImage" TEXT,
    "text1" TEXT,
    "image1" TEXT,
    "image1Caption" TEXT,
    "text2" TEXT,
    "image2" TEXT,
    "image2Caption" TEXT,
    "text3" TEXT,
    "image3" TEXT,
    "image3Caption" TEXT,
    "text4" TEXT,
    "image4" TEXT,
    "image4Caption" TEXT,
    "text5" TEXT,
    "image5" TEXT,
    "image5Caption" TEXT,
    "text6" TEXT,
    "image6" TEXT,
    "image6Caption" TEXT,
    "text7" TEXT,
    "image7" TEXT,
    "image7Caption" TEXT,
    "text8" TEXT,
    "image8" TEXT,
    "image8Caption" TEXT,
    "websites" TEXT[],
    "category" TEXT,
    "tags" TEXT[],
    "authorBio" TEXT,
    "status" "BlogStatus" NOT NULL DEFAULT 'idea',
    "sport" TEXT,
    "region" TEXT,
    "country" TEXT,
    "sources" TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourcePrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSchedule" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "blogId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "channel" TEXT,
    "platformAccount" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'planned',
    "campaignName" TEXT,
    "priority" TEXT,
    "notes" TEXT,
    "brand" TEXT,
    "sport" TEXT,
    "region" TEXT,
    "country" TEXT,
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contextType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "description" TEXT,
    "defaultTone" TEXT,
    "targetAudience" TEXT,
    "preferredWebsites" TEXT[],
    "sports" TEXT[],
    "regions" TEXT[],
    "countries" TEXT[],
    "bannedPhrases" TEXT[],
    "preferredCTAs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccess_clerkUserId_key" ON "UserAccess"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccess_email_key" ON "UserAccess"("email");

-- CreateIndex
CREATE INDEX "UserAccess_approvalStatus_role_idx" ON "UserAccess"("approvalStatus", "role");

-- CreateIndex
CREATE INDEX "Content_status_contentType_idx" ON "Content"("status", "contentType");

-- CreateIndex
CREATE INDEX "Content_brand_sport_region_country_idx" ON "Content"("brand", "sport", "region", "country");

-- CreateIndex
CREATE INDEX "Blog_status_postDate_idx" ON "Blog"("status", "postDate");

-- CreateIndex
CREATE INDEX "Blog_category_sport_region_country_idx" ON "Blog"("category", "sport", "region", "country");

-- CreateIndex
CREATE INDEX "ContentSchedule_scheduledFor_status_idx" ON "ContentSchedule"("scheduledFor", "status");

-- CreateIndex
CREATE INDEX "ContentSchedule_brand_sport_region_country_idx" ON "ContentSchedule"("brand", "sport", "region", "country");

-- CreateIndex
CREATE INDEX "ChatThread_userId_updatedAt_idx" ON "ChatThread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentActionLog_userId_createdAt_idx" ON "ContentActionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentActionLog_targetType_targetId_idx" ON "ContentActionLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_brandName_key" ON "BrandProfile"("brandName");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSchedule" ADD CONSTRAINT "ContentSchedule_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSchedule" ADD CONSTRAINT "ContentSchedule_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSchedule" ADD CONSTRAINT "ContentSchedule_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSchedule" ADD CONSTRAINT "ContentSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentActionLog" ADD CONSTRAINT "ContentActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
