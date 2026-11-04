-- CreateEnum
CREATE TYPE "InsuranceOfferDecisionType" AS ENUM ('offered', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "InsuranceOffer" (
    "id" TEXT NOT NULL,
    "trip" TEXT,
    "traveler" TEXT,
    "decision" "InsuranceOfferDecisionType" DEFAULT 'offered',
    "waiverNote" TEXT NOT NULL DEFAULT '',
    "recordedAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsuranceOffer_trip_idx" ON "InsuranceOffer"("trip");

-- CreateIndex
CREATE INDEX "InsuranceOffer_traveler_idx" ON "InsuranceOffer"("traveler");

-- CreateIndex
CREATE INDEX "InsuranceOffer_recordedBy_idx" ON "InsuranceOffer"("recordedBy");

-- AddForeignKey
ALTER TABLE "InsuranceOffer" ADD CONSTRAINT "InsuranceOffer_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceOffer" ADD CONSTRAINT "InsuranceOffer_traveler_fkey" FOREIGN KEY ("traveler") REFERENCES "Traveler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceOffer" ADD CONSTRAINT "InsuranceOffer_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
