-- AlterTable
ALTER TABLE "User" ADD COLUMN     "communeId" TEXT;

-- CreateIndex
CREATE INDEX "User_communeId_idx" ON "User"("communeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;
