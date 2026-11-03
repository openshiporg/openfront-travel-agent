/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "InquiryTripTypeType" AS ENUM ('honeymoon', 'family', 'group', 'corporate', 'cruise', 'adventure');

-- CreateEnum
CREATE TYPE "InquiryStatusType" AS ENUM ('new', 'qualifying', 'proposal', 'won', 'lost');

-- CreateEnum
CREATE TYPE "TripStatusType" AS ENUM ('planning', 'proposal_sent', 'accepted', 'booked', 'final_payment_due', 'paid_in_full', 'traveling', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProposalStatusType" AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'superseded', 'declined');

-- CreateEnum
CREATE TYPE "ProposalItemKindType" AS ENUM ('hotel', 'cruise', 'tour', 'flight', 'transfer', 'rail', 'insurance', 'activity', 'fee');

-- CreateEnum
CREATE TYPE "TripComponentKindType" AS ENUM ('hotel', 'cruise', 'tour', 'flight', 'transfer', 'rail', 'insurance', 'activity', 'fee');

-- CreateEnum
CREATE TYPE "TripComponentBookingStatusType" AS ENUM ('quoted', 'held', 'booked', 'ticketed', 'cancelled');

-- CreateEnum
CREATE TYPE "TripComponentPaymentModelType" AS ENUM ('client_pays_supplier', 'agency_collects');

-- CreateEnum
CREATE TYPE "TripComponentCommissionStatusType" AS ENUM ('expected', 'invoiced', 'received', 'short_paid', 'written_off');

-- CreateEnum
CREATE TYPE "SupplierKindType" AS ENUM ('hotel', 'cruise_line', 'tour_operator', 'dmc', 'airline', 'consolidator', 'insurer', 'transfer');

-- CreateEnum
CREATE TYPE "ClientInvoiceStatusType" AS ENUM ('draft', 'sent', 'partially_paid', 'paid', 'void');

-- CreateEnum
CREATE TYPE "ClientInvoiceLineKindType" AS ENUM ('planning_fee', 'component_deposit', 'component_final', 'insurance');

-- CreateEnum
CREATE TYPE "PaymentScheduleKindType" AS ENUM ('planning_fee', 'component_deposit', 'component_final');

-- CreateEnum
CREATE TYPE "PaymentScheduleStatusType" AS ENUM ('due', 'invoiced', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "ClientFundsEntryEntryTypeType" AS ENUM ('receipt', 'supplier_payment', 'refund_to_client', 'transfer_planning_fee', 'reversal');

-- CreateEnum
CREATE TYPE "AdvisorCommissionLedgerEntryTypeType" AS ENUM ('allocation', 'reversal');

-- CreateEnum
CREATE TYPE "DocumentKindType" AS ENUM ('passport', 'visa', 'insurance', 'supplier_confirmation', 'signed_terms');

-- CreateEnum
CREATE TYPE "TaskTypeType" AS ENUM ('deposit_due', 'final_due', 'passport_expiring', 'commission_overdue', 'follow_up');

-- CreateEnum
CREATE TYPE "TaskStatusType" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentCollectionDescriptionType" AS ENUM ('default', 'refund');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canIssueRefunds" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageClients" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCommissions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageDocuments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSuppliers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTasks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageTrips" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadAudit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onboardingStatus" TEXT DEFAULT 'not_started',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "preferences" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "preferenceTags" JSONB,
    "loyaltyNumbers" JSONB,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Traveler" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "knownTravelerNumber" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "dateOfBirth" TIMESTAMP(3),
    "passportExpiresAt" TIMESTAMP(3),
    "passportOnFile" BOOLEAN NOT NULL DEFAULT false,
    "client" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Traveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "destinations" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "budgetCents" INTEGER DEFAULT 0,
    "travelWindowStart" TIMESTAMP(3),
    "travelWindowEnd" TIMESTAMP(3),
    "client" TEXT,
    "assignedAdvisor" TEXT,
    "tripType" "InquiryTripTypeType" DEFAULT 'honeymoon',
    "partySize" INTEGER DEFAULT 1,
    "status" "InquiryStatusType" DEFAULT 'new',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "planningFeeCents" INTEGER DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "tripNumber" TEXT NOT NULL DEFAULT '',
    "client" TEXT,
    "advisor" TEXT,
    "inquiry" TEXT,
    "status" "TripStatusType" DEFAULT 'planning',
    "itineraryToken" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "introNote" TEXT NOT NULL DEFAULT '',
    "acceptedByName" TEXT NOT NULL DEFAULT '',
    "publicToken" TEXT NOT NULL DEFAULT '',
    "acceptedSnapshotHash" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedSnapshot" JSONB,
    "version" INTEGER DEFAULT 1,
    "status" "ProposalStatusType" DEFAULT 'draft',
    "trip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalOption" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "proposal" TEXT,
    "sort" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "sellCents" INTEGER DEFAULT 0,
    "option" TEXT,
    "kind" "ProposalItemKindType" DEFAULT 'hotel',
    "supplier" TEXT,
    "estimatedCommissionBps" INTEGER DEFAULT 0,
    "sort" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripComponent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "confirmationNumber" TEXT NOT NULL DEFAULT '',
    "cancellationPolicy" TEXT NOT NULL DEFAULT '',
    "sellCents" INTEGER DEFAULT 0,
    "netCostCents" INTEGER DEFAULT 0,
    "depositCents" INTEGER DEFAULT 0,
    "commissionCents" INTEGER DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "depositDueAt" TIMESTAMP(3),
    "finalDueAt" TIMESTAMP(3),
    "cancelPenaltySchedule" JSONB,
    "purchaseSnapshot" JSONB,
    "trip" TEXT,
    "supplier" TEXT,
    "kind" "TripComponentKindType" DEFAULT 'hotel',
    "bookingStatus" "TripComponentBookingStatusType" DEFAULT 'quoted',
    "paymentModel" "TripComponentPaymentModelType" DEFAULT 'client_pays_supplier',
    "commissionBps" INTEGER DEFAULT 0,
    "commissionStatus" "TripComponentCommissionStatusType" DEFAULT 'expected',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3),
    "trip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "day" TEXT,
    "component" TEXT,
    "sort" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "hostAgencyRelation" TEXT NOT NULL DEFAULT '',
    "bookingPortalUrl" TEXT NOT NULL DEFAULT '',
    "iataCliaNotes" TEXT NOT NULL DEFAULT '',
    "kind" "SupplierKindType" DEFAULT 'hotel',
    "defaultCommissionBps" INTEGER DEFAULT 0,
    "commissionPaymentTermsDays" INTEGER DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL DEFAULT '',
    "totalCents" INTEGER DEFAULT 0,
    "collectedCents" INTEGER DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "number" TEXT NOT NULL DEFAULT '',
    "trip" TEXT,
    "status" "ClientInvoiceStatusType" DEFAULT 'draft',
    "paymentCollection" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoiceLine" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "unitPriceCents" INTEGER DEFAULT 0,
    "feesCents" INTEGER DEFAULT 0,
    "taxCents" INTEGER DEFAULT 0,
    "snapshot" JSONB,
    "quantity" INTEGER DEFAULT 1,
    "kind" "ClientInvoiceLineKindType" DEFAULT 'planning_fee',
    "invoice" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" TEXT NOT NULL,
    "scheduleKey" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "kind" "PaymentScheduleKindType" DEFAULT 'planning_fee',
    "trip" TEXT,
    "component" TEXT,
    "status" "PaymentScheduleStatusType" DEFAULT 'due',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientFundsEntry" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "occurredAt" TIMESTAMP(3),
    "trip" TEXT,
    "component" TEXT,
    "entryType" "ClientFundsEntryEntryTypeType" DEFAULT 'receipt',
    "reversedBy" TEXT,
    "entryKey" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFundsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "component" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionReceipt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "supplier" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionAllocation" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER DEFAULT 0,
    "component" TEXT,
    "receipt" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorCommissionLedger" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER DEFAULT 0,
    "occurredAt" TIMESTAMP(3),
    "entryType" "AdvisorCommissionLedgerEntryTypeType" DEFAULT 'allocation',
    "advisor" TEXT,
    "component" TEXT,
    "reversedBy" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorCommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "checksumSha256" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "byteSize" INTEGER,
    "kind" "DocumentKindType" DEFAULT 'passport',
    "trip" TEXT,
    "traveler" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "taskKey" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "trip" TEXT,
    "assignee" TEXT,
    "type" "TaskTypeType" DEFAULT 'deposit_due',
    "status" "TaskStatusType" DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencySettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "defaultPlanningFeeCents" INTEGER DEFAULT 0,
    "refundApprovalThresholdCents" INTEGER DEFAULT 0,
    "hostAgencySplitBps" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "targetList" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestId" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createPaymentFunction" TEXT NOT NULL DEFAULT '',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT '',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT '',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT '',
    "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT '',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCollection" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "description" "PaymentCollectionDescriptionType" DEFAULT 'default',
    "amount" INTEGER NOT NULL,
    "authorizedAmount" INTEGER DEFAULT 0,
    "refundedAmount" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isInitiated" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER NOT NULL,
    "data" JSONB DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "paymentCollection" TEXT,
    "paymentProvider" TEXT,
    "paymentAuthorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "reservedAt" TIMESTAMP(3),
    "refundedAmount" INTEGER DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "data" JSONB,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT DEFAULT 'credit_card',
    "paymentProvider" TEXT,
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "cardBrand" TEXT NOT NULL DEFAULT '',
    "tipAmount" INTEGER DEFAULT 0,
    "isSplitPayment" BOOLEAN NOT NULL DEFAULT false,
    "splitPaymentIndex" INTEGER,
    "splitTotal" INTEGER,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "order" TEXT,
    "paymentCollection" TEXT,
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'processing',
    "reason" TEXT NOT NULL DEFAULT '',
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "providerData" JSONB,
    "processedAt" TIMESTAMP(3),
    "payment" TEXT,
    "order" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'received',
    "payload" JSONB,
    "rawBody" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER DEFAULT 0,
    "receivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "payment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "requestMethod" TEXT NOT NULL DEFAULT '',
    "requestParams" JSONB,
    "requestPath" TEXT NOT NULL DEFAULT '',
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "recoveryPoint" TEXT NOT NULL DEFAULT 'started',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Traveler_trips" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Traveler_components" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Destination_trips" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Traveler_client_idx" ON "Traveler"("client");

-- CreateIndex
CREATE INDEX "Inquiry_client_idx" ON "Inquiry"("client");

-- CreateIndex
CREATE INDEX "Inquiry_assignedAdvisor_idx" ON "Inquiry"("assignedAdvisor");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_tripNumber_key" ON "Trip"("tripNumber");

-- CreateIndex
CREATE INDEX "Trip_client_idx" ON "Trip"("client");

-- CreateIndex
CREATE INDEX "Trip_advisor_idx" ON "Trip"("advisor");

-- CreateIndex
CREATE INDEX "Trip_inquiry_idx" ON "Trip"("inquiry");

-- CreateIndex
CREATE INDEX "Proposal_trip_idx" ON "Proposal"("trip");

-- CreateIndex
CREATE INDEX "ProposalOption_proposal_idx" ON "ProposalOption"("proposal");

-- CreateIndex
CREATE INDEX "ProposalItem_option_idx" ON "ProposalItem"("option");

-- CreateIndex
CREATE INDEX "ProposalItem_supplier_idx" ON "ProposalItem"("supplier");

-- CreateIndex
CREATE INDEX "TripComponent_trip_idx" ON "TripComponent"("trip");

-- CreateIndex
CREATE INDEX "TripComponent_supplier_idx" ON "TripComponent"("supplier");

-- CreateIndex
CREATE INDEX "ItineraryDay_trip_idx" ON "ItineraryDay"("trip");

-- CreateIndex
CREATE INDEX "ItineraryItem_day_idx" ON "ItineraryItem"("day");

-- CreateIndex
CREATE INDEX "ItineraryItem_component_idx" ON "ItineraryItem"("component");

-- CreateIndex
CREATE INDEX "SupplierContact_supplier_idx" ON "SupplierContact"("supplier");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_number_key" ON "ClientInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_paymentCollection_key" ON "ClientInvoice"("paymentCollection");

-- CreateIndex
CREATE INDEX "ClientInvoice_trip_idx" ON "ClientInvoice"("trip");

-- CreateIndex
CREATE INDEX "ClientInvoiceLine_invoice_idx" ON "ClientInvoiceLine"("invoice");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSchedule_scheduleKey_key" ON "PaymentSchedule"("scheduleKey");

-- CreateIndex
CREATE INDEX "PaymentSchedule_trip_idx" ON "PaymentSchedule"("trip");

-- CreateIndex
CREATE INDEX "PaymentSchedule_component_idx" ON "PaymentSchedule"("component");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFundsEntry_reversedBy_key" ON "ClientFundsEntry"("reversedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ClientFundsEntry_entryKey_key" ON "ClientFundsEntry"("entryKey");

-- CreateIndex
CREATE INDEX "ClientFundsEntry_trip_idx" ON "ClientFundsEntry"("trip");

-- CreateIndex
CREATE INDEX "ClientFundsEntry_component_idx" ON "ClientFundsEntry"("component");

-- CreateIndex
CREATE INDEX "SupplierPayment_component_idx" ON "SupplierPayment"("component");

-- CreateIndex
CREATE INDEX "CommissionReceipt_supplier_idx" ON "CommissionReceipt"("supplier");

-- CreateIndex
CREATE INDEX "CommissionAllocation_component_idx" ON "CommissionAllocation"("component");

-- CreateIndex
CREATE INDEX "CommissionAllocation_receipt_idx" ON "CommissionAllocation"("receipt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorCommissionLedger_reversedBy_key" ON "AdvisorCommissionLedger"("reversedBy");

-- CreateIndex
CREATE INDEX "AdvisorCommissionLedger_advisor_idx" ON "AdvisorCommissionLedger"("advisor");

-- CreateIndex
CREATE INDEX "AdvisorCommissionLedger_component_idx" ON "AdvisorCommissionLedger"("component");

-- CreateIndex
CREATE INDEX "Document_trip_idx" ON "Document"("trip");

-- CreateIndex
CREATE INDEX "Document_traveler_idx" ON "Document"("traveler");

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskKey_key" ON "Task"("taskKey");

-- CreateIndex
CREATE INDEX "Task_trip_idx" ON "Task"("trip");

-- CreateIndex
CREATE INDEX "Task_assignee_idx" ON "Task"("assignee");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_idx" ON "AuditEvent"("actor");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_idempotencyKey_key" ON "PaymentSession"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentSession_paymentCollection_idx" ON "PaymentSession"("paymentCollection");

-- CreateIndex
CREATE INDEX "PaymentSession_paymentProvider_idx" ON "PaymentSession"("paymentProvider");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_paymentProvider_idx" ON "Payment"("paymentProvider");

-- CreateIndex
CREATE INDEX "Payment_order_idx" ON "Payment"("order");

-- CreateIndex
CREATE INDEX "Payment_paymentCollection_idx" ON "Payment"("paymentCollection");

-- CreateIndex
CREATE INDEX "Payment_processedBy_idx" ON "Payment"("processedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_order_idx" ON "Refund"("order");

-- CreateIndex
CREATE INDEX "Refund_requestedBy_idx" ON "Refund"("requestedBy");

-- CreateIndex
CREATE INDEX "Refund_approvedBy_idx" ON "Refund"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventKey_key" ON "PaymentWebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_providerCode_idx" ON "PaymentWebhookEvent"("providerCode");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_providerEventId_idx" ON "PaymentWebhookEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_receivedAt_idx" ON "PaymentWebhookEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_payment_idx" ON "PaymentWebhookEvent"("payment");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_idempotencyKey_key" ON "IdempotencyKey"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "_Traveler_trips_AB_unique" ON "_Traveler_trips"("A", "B");

-- CreateIndex
CREATE INDEX "_Traveler_trips_B_index" ON "_Traveler_trips"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Traveler_components_AB_unique" ON "_Traveler_components"("A", "B");

-- CreateIndex
CREATE INDEX "_Traveler_components_B_index" ON "_Traveler_components"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Destination_trips_AB_unique" ON "_Destination_trips"("A", "B");

-- CreateIndex
CREATE INDEX "_Destination_trips_B_index" ON "_Destination_trips"("B");

-- AddForeignKey
ALTER TABLE "Traveler" ADD CONSTRAINT "Traveler_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_assignedAdvisor_fkey" FOREIGN KEY ("assignedAdvisor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_client_fkey" FOREIGN KEY ("client") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_advisor_fkey" FOREIGN KEY ("advisor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_inquiry_fkey" FOREIGN KEY ("inquiry") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalOption" ADD CONSTRAINT "ProposalOption_proposal_fkey" FOREIGN KEY ("proposal") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_option_fkey" FOREIGN KEY ("option") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripComponent" ADD CONSTRAINT "TripComponent_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripComponent" ADD CONSTRAINT "TripComponent_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_day_fkey" FOREIGN KEY ("day") REFERENCES "ItineraryDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_paymentCollection_fkey" FOREIGN KEY ("paymentCollection") REFERENCES "PaymentCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundsEntry" ADD CONSTRAINT "ClientFundsEntry_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundsEntry" ADD CONSTRAINT "ClientFundsEntry_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFundsEntry" ADD CONSTRAINT "ClientFundsEntry_reversedBy_fkey" FOREIGN KEY ("reversedBy") REFERENCES "ClientFundsEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionReceipt" ADD CONSTRAINT "CommissionReceipt_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_receipt_fkey" FOREIGN KEY ("receipt") REFERENCES "CommissionReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorCommissionLedger" ADD CONSTRAINT "AdvisorCommissionLedger_advisor_fkey" FOREIGN KEY ("advisor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorCommissionLedger" ADD CONSTRAINT "AdvisorCommissionLedger_component_fkey" FOREIGN KEY ("component") REFERENCES "TripComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorCommissionLedger" ADD CONSTRAINT "AdvisorCommissionLedger_reversedBy_fkey" FOREIGN KEY ("reversedBy") REFERENCES "AdvisorCommissionLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_traveler_fkey" FOREIGN KEY ("traveler") REFERENCES "Traveler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_trip_fkey" FOREIGN KEY ("trip") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignee_fkey" FOREIGN KEY ("assignee") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_paymentCollection_fkey" FOREIGN KEY ("paymentCollection") REFERENCES "PaymentCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_fkey" FOREIGN KEY ("order") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentCollection_fkey" FOREIGN KEY ("paymentCollection") REFERENCES "PaymentCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_order_fkey" FOREIGN KEY ("order") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_trips" ADD CONSTRAINT "_Traveler_trips_A_fkey" FOREIGN KEY ("A") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_trips" ADD CONSTRAINT "_Traveler_trips_B_fkey" FOREIGN KEY ("B") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_components" ADD CONSTRAINT "_Traveler_components_A_fkey" FOREIGN KEY ("A") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Traveler_components" ADD CONSTRAINT "_Traveler_components_B_fkey" FOREIGN KEY ("B") REFERENCES "TripComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Destination_trips" ADD CONSTRAINT "_Destination_trips_A_fkey" FOREIGN KEY ("A") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Destination_trips" ADD CONSTRAINT "_Destination_trips_B_fkey" FOREIGN KEY ("B") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
