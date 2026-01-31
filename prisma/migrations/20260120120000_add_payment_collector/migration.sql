-- Add missing schema objects for collectors, taxpayer fields, and related tables
CREATE TYPE "CollectorStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "Collector" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "CollectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Collector_code_key" ON "Collector"("code");
CREATE INDEX "Collector_status_idx" ON "Collector"("status");
CREATE INDEX "Collector_name_idx" ON "Collector"("name");

ALTER TABLE "Taxpayer"
  ADD COLUMN "neighborhood" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "commune" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Taxpayer" ALTER COLUMN "phone" SET DEFAULT '';
ALTER TABLE "Taxpayer" ALTER COLUMN "phone" SET NOT NULL;

ALTER TABLE "Taxpayer" ALTER COLUMN "neighborhood" DROP DEFAULT;
ALTER TABLE "Taxpayer" ALTER COLUMN "commune" DROP DEFAULT;
ALTER TABLE "Taxpayer" ALTER COLUMN "phone" DROP DEFAULT;

CREATE INDEX "Taxpayer_neighborhood_idx" ON "Taxpayer"("neighborhood");
CREATE INDEX "Taxpayer_commune_idx" ON "Taxpayer"("commune");
CREATE INDEX "Taxpayer_phone_idx" ON "Taxpayer"("phone");

CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "commune" TEXT,
    "neighborhood" TEXT,
    "category" TEXT,
    "zone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxRule_taxId_idx" ON "TaxRule"("taxId");
CREATE INDEX "TaxRule_active_idx" ON "TaxRule"("active");
CREATE INDEX "TaxRule_commune_idx" ON "TaxRule"("commune");
CREATE INDEX "TaxRule_neighborhood_idx" ON "TaxRule"("neighborhood");
CREATE INDEX "TaxRule_category_idx" ON "TaxRule"("category");
CREATE INDEX "TaxRule_zone_idx" ON "TaxRule"("zone");

ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxId_fkey"
  FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "municipalityName" TEXT NOT NULL,
    "municipalityLogo" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'XOF',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Niamey',
    "receiptFooter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- Add collectorId to Payment and link to Collector
ALTER TABLE "Payment" ADD COLUMN "collectorId" TEXT NOT NULL;

CREATE INDEX "Payment_collectorId_idx" ON "Payment"("collectorId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectorId_fkey"
  FOREIGN KEY ("collectorId") REFERENCES "Collector"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
