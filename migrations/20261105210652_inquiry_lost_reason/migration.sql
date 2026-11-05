/*
  Warnings:

  - The primary key for the `_Traveler_parties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Traveler_rooms` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_Traveler_parties` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Traveler_rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "lostReason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "_Traveler_parties" DROP CONSTRAINT "_Traveler_parties_AB_pkey";

-- AlterTable
ALTER TABLE "_Traveler_rooms" DROP CONSTRAINT "_Traveler_rooms_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_Traveler_parties_AB_unique" ON "_Traveler_parties"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Traveler_rooms_AB_unique" ON "_Traveler_rooms"("A", "B");
