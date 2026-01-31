-- DropIndex
DROP INDEX IF EXISTS "Taxpayer_code_key";

-- AlterTable
ALTER TABLE "Taxpayer"
  DROP COLUMN IF EXISTS "code",
  DROP COLUMN IF EXISTS "zone",
  DROP COLUMN IF EXISTS "paperSurface",
  DROP COLUMN IF EXISTS "otherSurface",
  DROP COLUMN IF EXISTS "lightSurface";
