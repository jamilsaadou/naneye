-- AlterTable
ALTER TABLE "Commune" ADD COLUMN "code" TEXT;
ALTER TABLE "TaxpayerCategory" ADD COLUMN "code" TEXT;
ALTER TABLE "Taxpayer" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Commune_code_key" ON "Commune"("code");
CREATE UNIQUE INDEX "TaxpayerCategory_code_key" ON "TaxpayerCategory"("code");
CREATE UNIQUE INDEX "Taxpayer_code_key" ON "Taxpayer"("code");
