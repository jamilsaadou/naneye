-- Add year column for notices
ALTER TABLE "Notice" ADD COLUMN "year" INTEGER;

-- Backfill year from periodStart
UPDATE "Notice"
SET "year" = EXTRACT(YEAR FROM "periodStart")::int
WHERE "year" IS NULL;

-- Remove duplicate notices per taxpayer/year (keep the most recent)
DELETE FROM "Notice" n
USING "Notice" n2
WHERE n."taxpayerId" = n2."taxpayerId"
  AND n.year = n2.year
  AND (
    n."createdAt" < n2."createdAt"
    OR (n."createdAt" = n2."createdAt" AND n.id < n2.id)
  );

-- Enforce required year
ALTER TABLE "Notice" ALTER COLUMN "year" SET NOT NULL;

-- Unique constraint to enforce one notice per taxpayer per year
CREATE UNIQUE INDEX "Notice_taxpayerId_year_key" ON "Notice"("taxpayerId", "year");

-- Index for year lookups
CREATE INDEX "Notice_year_idx" ON "Notice"("year");
