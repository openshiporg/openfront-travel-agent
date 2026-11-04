-- AlterTable
ALTER TABLE "TripComponent" ADD COLUMN     "confirmedBy" TEXT;

-- CreateIndex
CREATE INDEX "TripComponent_confirmedBy_idx" ON "TripComponent"("confirmedBy");

-- AddForeignKey
ALTER TABLE "TripComponent" ADD CONSTRAINT "TripComponent_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
