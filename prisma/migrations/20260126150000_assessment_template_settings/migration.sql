-- Add header/footer templates for assessment (avis d'imposition)
ALTER TABLE "AppSetting" ADD COLUMN "assessmentHeader" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "assessmentFooter" TEXT;
