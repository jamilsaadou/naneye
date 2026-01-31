-- Replace enum payment method with free text
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE TEXT USING "method"::text;
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'CASH';
DROP TYPE IF EXISTS "PaymentMethod";
