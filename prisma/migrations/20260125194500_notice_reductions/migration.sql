CREATE TABLE "NoticeReduction" (
  "id" TEXT NOT NULL,
  "noticeId" TEXT NOT NULL,
  "taxpayerId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "previousTotal" DECIMAL(14,2) NOT NULL,
  "newTotal" DECIMAL(14,2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,

  CONSTRAINT "NoticeReduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NoticeReduction_noticeId_idx" ON "NoticeReduction"("noticeId");
CREATE INDEX "NoticeReduction_taxpayerId_idx" ON "NoticeReduction"("taxpayerId");
CREATE INDEX "NoticeReduction_createdById_idx" ON "NoticeReduction"("createdById");

ALTER TABLE "NoticeReduction" ADD CONSTRAINT "NoticeReduction_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoticeReduction" ADD CONSTRAINT "NoticeReduction_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "Taxpayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NoticeReduction" ADD CONSTRAINT "NoticeReduction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
