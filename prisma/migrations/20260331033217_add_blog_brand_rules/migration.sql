-- DropIndex
DROP INDEX "Blog_category_sport_region_country_idx";

-- AlterTable
ALTER TABLE "Blog" ADD COLUMN     "brand" TEXT;

-- CreateIndex
CREATE INDEX "Blog_brand_category_sport_region_country_idx" ON "Blog"("brand", "category", "sport", "region", "country");
