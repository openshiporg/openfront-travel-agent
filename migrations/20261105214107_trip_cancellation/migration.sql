-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "cancelReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cancelledAt" TIMESTAMP(3);
