-- CreateTable
CREATE TABLE "TaxpayerCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sanitationAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxpayerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxpayerMeasure" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxpayerMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerCategory_label_key" ON "TaxpayerCategory"("label");

-- CreateIndex
CREATE UNIQUE INDEX "TaxpayerMeasure_taxpayerId_taxId_key" ON "TaxpayerMeasure"("taxpayerId", "taxId");

-- CreateIndex
CREATE INDEX "TaxpayerMeasure_taxpayerId_idx" ON "TaxpayerMeasure"("taxpayerId");

-- CreateIndex
CREATE INDEX "TaxpayerMeasure_taxId_idx" ON "TaxpayerMeasure"("taxId");

-- AddForeignKey
ALTER TABLE "TaxpayerMeasure" ADD CONSTRAINT "TaxpayerMeasure_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "Taxpayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxpayerMeasure" ADD CONSTRAINT "TaxpayerMeasure_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE CASCADE ON UPDATE CASCADE;
