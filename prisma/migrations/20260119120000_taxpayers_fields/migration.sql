-- CreateEnum
CREATE TYPE "TaxpayerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Taxpayer" ADD COLUMN     "category" TEXT,
ADD COLUMN     "status" "TaxpayerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "zone" TEXT;

-- CreateIndex
CREATE INDEX "Taxpayer_category_idx" ON "Taxpayer"("category");

-- CreateIndex
CREATE INDEX "Taxpayer_zone_idx" ON "Taxpayer"("zone");

-- CreateIndex
CREATE INDEX "Taxpayer_status_idx" ON "Taxpayer"("status");
