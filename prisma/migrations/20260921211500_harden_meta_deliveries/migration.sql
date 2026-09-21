ALTER TABLE "PublishedPost"
ADD COLUMN "deliveryKey" TEXT,
ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deliveryError" TEXT;

CREATE UNIQUE INDEX "PublishedPost_deliveryKey_key" ON "PublishedPost"("deliveryKey");
