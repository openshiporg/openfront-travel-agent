-- CreateEnum
CREATE TYPE "ManagerApprovalActionTypeType" AS ENUM ('refund_payment', 'commission_overpayment', 'commission_writeoff');

-- CreateEnum
CREATE TYPE "ManagerApprovalStatusType" AS ENUM ('requested', 'approved', 'rejected', 'consumed');

-- AlterTable
ALTER TABLE "AgencySettings" ALTER COLUMN "refundApprovalThresholdCents" SET DEFAULT 50000;

-- AlterTable
ALTER TABLE "CommissionAllocation" ADD COLUMN     "approval" TEXT,
ADD COLUMN     "overpaymentCents" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "ManagerApproval" (
    "id" TEXT NOT NULL,
    "actionType" "ManagerApprovalActionTypeType" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "requestFingerprint" TEXT NOT NULL DEFAULT '',
    "requestPayload" JSONB,
    "status" "ManagerApprovalStatusType" NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedEntityType" TEXT NOT NULL DEFAULT '',
    "consumedEntityId" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerApproval_actionType_idx" ON "ManagerApproval"("actionType");

-- CreateIndex
CREATE INDEX "ManagerApproval_targetId_idx" ON "ManagerApproval"("targetId");

-- CreateIndex
CREATE INDEX "ManagerApproval_status_idx" ON "ManagerApproval"("status");

-- CreateIndex
CREATE INDEX "ManagerApproval_requestedAt_idx" ON "ManagerApproval"("requestedAt");

-- CreateIndex
CREATE INDEX "ManagerApproval_expiresAt_idx" ON "ManagerApproval"("expiresAt");

-- CreateIndex
CREATE INDEX "ManagerApproval_requestedBy_idx" ON "ManagerApproval"("requestedBy");

-- CreateIndex
CREATE INDEX "ManagerApproval_approvedBy_idx" ON "ManagerApproval"("approvedBy");

-- CreateIndex
CREATE INDEX "CommissionAllocation_approval_idx" ON "CommissionAllocation"("approval");

-- AddForeignKey
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_approval_fkey" FOREIGN KEY ("approval") REFERENCES "ManagerApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerApproval" ADD CONSTRAINT "ManagerApproval_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
