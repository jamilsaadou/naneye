-- AlterTable
ALTER TABLE "User" ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "enabledModules" = ARRAY['dashboard','taxpayers','collections','reports','audit','settings']
WHERE "enabledModules" = ARRAY[]::TEXT[];
