-- Add SMTP configuration fields
ALTER TABLE "AppSetting" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "AppSetting" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "smtpPassword" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "smtpFrom" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "smtpSecure" BOOLEAN DEFAULT FALSE;
