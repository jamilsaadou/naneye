-- Add external txn id to payments
ALTER TABLE "Payment" ADD COLUMN "externalTxnId" TEXT;
CREATE UNIQUE INDEX "Payment_externalTxnId_key" ON "Payment"("externalTxnId");

-- Add jwt secret to collectors
ALTER TABLE "Collector" ADD COLUMN "jwtSecret" TEXT;

-- Create collector API logs table
CREATE TABLE "CollectorApiLog" (
  "id" TEXT NOT NULL,
  "collectorId" TEXT,
  "noticeNumber" TEXT,
  "requestTxnId" TEXT,
  "jwtTxnId" TEXT,
  "jwtIssuer" TEXT,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectorApiLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectorApiLog_collectorId_idx" ON "CollectorApiLog"("collectorId");
CREATE INDEX "CollectorApiLog_requestTxnId_idx" ON "CollectorApiLog"("requestTxnId");
CREATE INDEX "CollectorApiLog_jwtTxnId_idx" ON "CollectorApiLog"("jwtTxnId");
CREATE INDEX "CollectorApiLog_status_idx" ON "CollectorApiLog"("status");
CREATE INDEX "CollectorApiLog_createdAt_idx" ON "CollectorApiLog"("createdAt");

ALTER TABLE "CollectorApiLog" ADD CONSTRAINT "CollectorApiLog_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
