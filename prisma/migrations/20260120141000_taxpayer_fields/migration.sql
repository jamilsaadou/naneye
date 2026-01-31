-- AlterTable
ALTER TABLE "Taxpayer"
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "comment" TEXT,
  ADD COLUMN "latitude" DECIMAL(10,6),
  ADD COLUMN "longitude" DECIMAL(10,6),
  ADD COLUMN "paperSurface" DECIMAL(14,2),
  ADD COLUMN "otherSurface" DECIMAL(14,2),
  ADD COLUMN "lightSurface" DECIMAL(14,2),
  ADD COLUMN "startedAt" TIMESTAMP(3);
