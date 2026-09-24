-- Add an explicit publishing-version pointer without changing existing content or variants.
ALTER TABLE "Content" ADD COLUMN "selectedVariantId" TEXT;

CREATE INDEX "Content_selectedVariantId_idx" ON "Content"("selectedVariantId");

ALTER TABLE "Content"
ADD CONSTRAINT "Content_selectedVariantId_fkey"
FOREIGN KEY ("selectedVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
