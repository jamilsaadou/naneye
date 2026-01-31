-- CreateTable
CREATE TABLE "TaxpayerPhoto" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxpayerPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxpayerPhoto_taxpayerId_idx" ON "TaxpayerPhoto"("taxpayerId");

-- AddForeignKey
ALTER TABLE "TaxpayerPhoto" ADD CONSTRAINT "TaxpayerPhoto_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "Taxpayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
