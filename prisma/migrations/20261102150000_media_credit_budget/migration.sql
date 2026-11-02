ALTER TABLE "ContentPlan" ADD COLUMN "mediaCreditBudget" INTEGER;
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_mediaCreditBudget_nonnegative" CHECK ("mediaCreditBudget" IS NULL OR "mediaCreditBudget" >= 0);
