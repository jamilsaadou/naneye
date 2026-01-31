-- User supervisor relationship
ALTER TABLE "User" ADD COLUMN "supervisorId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_supervisorId_idx" ON "User"("supervisorId");

-- Reduction approval workflow
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NoticeReductionStatus') THEN
    CREATE TYPE "NoticeReductionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END$$;

ALTER TABLE "NoticeReduction" ADD COLUMN "status" "NoticeReductionStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "NoticeReduction" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "NoticeReduction" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "NoticeReduction" ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "NoticeReduction" ADD CONSTRAINT "NoticeReduction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "NoticeReduction_status_idx" ON "NoticeReduction"("status");
CREATE INDEX "NoticeReduction_reviewedById_idx" ON "NoticeReduction"("reviewedById");

-- Backfill existing reductions as approved
UPDATE "NoticeReduction" SET "status" = 'APPROVED' WHERE "status" IS NULL;
