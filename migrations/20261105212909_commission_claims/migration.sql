-- AlterTable
ALTER TABLE "TripComponent" ADD COLUMN     "commissionClaimReference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "commissionClaimedAt" TIMESTAMP(3);
