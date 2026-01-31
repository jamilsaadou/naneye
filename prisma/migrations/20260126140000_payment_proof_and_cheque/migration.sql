-- Add cheque payment method and optional proof URL on payments
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';
ALTER TABLE "Payment" ADD COLUMN "proofUrl" TEXT;
