-- CreateTable
CREATE TABLE "_UserAccessibleCommunes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserAccessibleCommunes_AB_unique" ON "_UserAccessibleCommunes"("A", "B");

-- CreateIndex
CREATE INDEX "_UserAccessibleCommunes_B_index" ON "_UserAccessibleCommunes"("B");

-- AddForeignKey
ALTER TABLE "_UserAccessibleCommunes" ADD CONSTRAINT "_UserAccessibleCommunes_A_fkey" FOREIGN KEY ("A") REFERENCES "Commune"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserAccessibleCommunes" ADD CONSTRAINT "_UserAccessibleCommunes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
