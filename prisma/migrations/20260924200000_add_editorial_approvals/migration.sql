CREATE TYPE "EditorialApprovalTargetType" AS ENUM ('content_plan', 'content_plan_item', 'content', 'blog', 'content_variant', 'schedule');
CREATE TYPE "EditorialApprovalDecision" AS ENUM ('pending', 'approved', 'changes_requested', 'rejected', 'revoked');

CREATE TABLE "EditorialApproval" (
  "id" TEXT NOT NULL,
  "targetType" "EditorialApprovalTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "decision" "EditorialApprovalDecision" NOT NULL DEFAULT 'pending',
  "requestComment" TEXT,
  "decisionComment" TEXT,
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditorialApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EditorialApproval_targetType_targetId_createdAt_idx" ON "EditorialApproval"("targetType", "targetId", "createdAt");
CREATE INDEX "EditorialApproval_decision_createdAt_idx" ON "EditorialApproval"("decision", "createdAt");
ALTER TABLE "EditorialApproval" ADD CONSTRAINT "EditorialApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EditorialApproval" ADD CONSTRAINT "EditorialApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "UserAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('schedule:' || s."id"), 'schedule', s."id", 'approved', 'Imported from existing schedule approval', 'Approval preserved during editorial ledger migration', s."approvedById", s."approvedById", s."updatedAt", s."updatedAt", s."updatedAt", s."updatedAt"
FROM "ContentSchedule" s WHERE s."approvedById" IS NOT NULL;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('content:' || c."id"), 'content', c."id", 'approved', 'Imported from existing content status', 'Approval preserved during editorial ledger migration', c."updatedById", c."updatedById", c."updatedAt", c."updatedAt", c."updatedAt", c."updatedAt"
FROM "Content" c WHERE c."status" = 'approved' AND c."updatedById" IS NOT NULL;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('blog:' || b."id"), 'blog', b."id", 'approved', 'Imported from existing blog status', 'Approval preserved during editorial ledger migration', b."updatedById", b."updatedById", b."updatedAt", b."updatedAt", b."updatedAt", b."updatedAt"
FROM "Blog" b WHERE b."status" = 'approved' AND b."updatedById" IS NOT NULL;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('plan:' || p."id"), 'content_plan', p."id", 'approved', 'Imported from existing plan status', 'Approval preserved during editorial ledger migration', p."updatedById", p."updatedById", p."updatedAt", p."updatedAt", p."updatedAt", p."updatedAt"
FROM "ContentPlan" p WHERE p."status" = 'approved' AND p."updatedById" IS NOT NULL;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('variant:' || v."id"), 'content_variant', v."id", 'approved', 'Imported from existing variant status', 'Approval preserved during editorial ledger migration', v."updatedById", v."updatedById", v."updatedAt", v."updatedAt", v."updatedAt", v."updatedAt"
FROM "ContentVariant" v WHERE v."status" = 'approved' AND v."updatedById" IS NOT NULL;

INSERT INTO "EditorialApproval" ("id", "targetType", "targetId", "decision", "requestComment", "decisionComment", "requestedById", "decidedById", "requestedAt", "decidedAt", "createdAt", "updatedAt")
SELECT 'legacy_' || md5('plan_item:' || i."id"), 'content_plan_item', i."id", 'approved', 'Imported from existing plan item status', 'Approval preserved during editorial ledger migration', p."updatedById", p."updatedById", i."updatedAt", i."updatedAt", i."updatedAt", i."updatedAt"
FROM "ContentPlanItem" i JOIN "ContentPlan" p ON p."id" = i."planId" WHERE i."status" = 'approved' AND p."updatedById" IS NOT NULL;
