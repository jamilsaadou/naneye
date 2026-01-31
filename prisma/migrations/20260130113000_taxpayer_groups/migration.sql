-- CreateTable
CREATE TABLE "TaxpayerGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxpayerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerGroup_commune_name_key" ON "TaxpayerGroup"("commune", "name");

-- CreateIndex
CREATE INDEX "TaxpayerGroup_commune_idx" ON "TaxpayerGroup"("commune");

-- AlterTable
ALTER TABLE "Taxpayer" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Taxpayer_groupId_idx" ON "Taxpayer"("groupId");

-- AddForeignKey
ALTER TABLE "Taxpayer" ADD CONSTRAINT "Taxpayer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaxpayerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
