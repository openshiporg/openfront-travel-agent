-- AlterTable
ALTER TABLE "ClientInvoice" ADD COLUMN     "party" TEXT;

-- CreateTable
CREATE TABLE "TripParty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "portalToken" TEXT NOT NULL DEFAULT '',
    "trip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRoom" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "roomType" TEXT NOT NULL DEFAULT '',
    "trip" TEXT,
    "party" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Traveler_parties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Traveler_parties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Traveler_rooms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Traveler_rooms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "TripParty_trip_idx" ON "TripParty"("trip");

-- CreateIndex
CREATE INDEX "TripRoom_trip_idx" ON "TripRoom"("trip");

-- CreateIndex
CREATE INDEX "TripRoom_party_idx" ON "TripRoom"("party");

-- CreateIndex
CREATE INDEX "_Traveler_parties_B_index" ON "_Traveler_parties"("B");

-- CreateIndex
CREATE INDEX "_Traveler_rooms_B_index" ON "_Traveler_rooms"("B");

-- CreateIndex
CREATE INDEX "ClientInvoice_party_idx" ON "ClientInvoice"("party");

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_party_fkey" FOREIGN KEY ("party") REFERENCES "TripParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripParty" ADD CONSTRAINT "TripParty_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRoom" ADD CONSTRAINT "TripRoom_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRoom" ADD CONSTRAINT "TripRoom_party_fkey" FOREIGN KEY ("party") REFERENCES "TripParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_parties" ADD CONSTRAINT "_Traveler_parties_A_fkey" FOREIGN KEY ("A") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_parties" ADD CONSTRAINT "_Traveler_parties_B_fkey" FOREIGN KEY ("B") REFERENCES "TripParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_rooms" ADD CONSTRAINT "_Traveler_rooms_A_fkey" FOREIGN KEY ("A") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_rooms" ADD CONSTRAINT "_Traveler_rooms_B_fkey" FOREIGN KEY ("B") REFERENCES "TripRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
