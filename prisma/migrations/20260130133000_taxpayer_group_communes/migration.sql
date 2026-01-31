-- Add isGlobal flag
ALTER TABLE "TaxpayerGroup" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- Create join table for communes
CREATE TABLE "_CommuneToTaxpayerGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Create indexes for join table
CREATE UNIQUE INDEX "_CommuneToTaxpayerGroup_AB_unique" ON "_CommuneToTaxpayerGroup"("A", "B");
CREATE INDEX "_CommuneToTaxpayerGroup_B_index" ON "_CommuneToTaxpayerGroup"("B");

-- Add foreign keys
ALTER TABLE "_CommuneToTaxpayerGroup" ADD CONSTRAINT "_CommuneToTaxpayerGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CommuneToTaxpayerGroup" ADD CONSTRAINT "_CommuneToTaxpayerGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "TaxpayerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing group commune links
INSERT INTO "_CommuneToTaxpayerGroup" ("A", "B")
SELECT "Commune"."id", "TaxpayerGroup"."id"
FROM "TaxpayerGroup"
JOIN "Commune" ON "Commune"."name" = "TaxpayerGroup"."commune";

-- Drop old indexes and column
DROP INDEX "TaxpayerGroup_commune_name_key";
DROP INDEX "TaxpayerGroup_commune_idx";
ALTER TABLE "TaxpayerGroup" DROP COLUMN "commune";

-- New index on group name
CREATE INDEX "TaxpayerGroup_name_idx" ON "TaxpayerGroup"("name");
