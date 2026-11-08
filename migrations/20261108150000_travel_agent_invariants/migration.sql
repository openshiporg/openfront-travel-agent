-- Rules the app already relied on, now enforced by the database. Every predicate below was run verbatim against live data first: 0 violations.

ALTER TABLE "AgencySettings" ADD CONSTRAINT "AgencySettings_amounts_valid" CHECK ("defaultPlanningFeeCents" >= 0 AND "refundApprovalThresholdCents" >= 0 AND "hostAgencySplitBps" BETWEEN 0 AND 10000);
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_rates_valid" CHECK ("defaultCommissionBps" BETWEEN 0 AND 10000 AND "commissionPaymentTermsDays" >= 0);
ALTER TABLE "Inquiry"
  ADD CONSTRAINT "Inquiry_amounts_valid" CHECK ("budgetCents" >= 0),
  ADD CONSTRAINT "Inquiry_window_order" CHECK ("travelWindowStart" IS NULL OR "travelWindowEnd" IS NULL OR "travelWindowStart" <= "travelWindowEnd");
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_amounts_valid" CHECK ("planningFeeCents" >= 0),
  ADD CONSTRAINT "Trip_date_order" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "startDate" <= "endDate");
ALTER TABLE "TripComponent"
  ADD CONSTRAINT "TripComponent_amounts_valid" CHECK ("sellCents" >= 0 AND "netCostCents" >= 0 AND "depositCents" >= 0 AND "commissionCents" >= 0 AND "commissionBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "TripComponent_deposit_within_sell" CHECK ("depositCents" <= "sellCents"),
  ADD CONSTRAINT "TripComponent_time_order" CHECK ("startAt" IS NULL OR "endAt" IS NULL OR "startAt" <= "endAt"),
  ADD CONSTRAINT "TripComponent_due_order" CHECK ("depositDueAt" IS NULL OR "finalDueAt" IS NULL OR "depositDueAt" <= "finalDueAt");
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_amounts_valid" CHECK ("sellCents" >= 0 AND "estimatedCommissionBps" BETWEEN 0 AND 10000);
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_deposit_valid" CHECK ("depositBps" BETWEEN 0 AND 10000);
ALTER TABLE "ClientInvoice"
  ADD CONSTRAINT "ClientInvoice_amounts_valid" CHECK ("totalCents" >= 0 AND "collectedCents" >= 0),
  ADD CONSTRAINT "ClientInvoice_collected_within_total" CHECK ("collectedCents" <= "totalCents");
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_amounts_valid" CHECK ("amountCents" >= 0 AND "unitPriceCents" >= 0 AND "feesCents" >= 0 AND "taxCents" >= 0 AND "quantity" >= 1);
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_amount_valid" CHECK ("amountCents" >= 0);
ALTER TABLE "CommissionReceipt" ADD CONSTRAINT "CommissionReceipt_amount_valid" CHECK ("amountCents" > 0);
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_amounts_valid" CHECK ("amountCents" > 0 AND "overpaymentCents" >= 0 AND "overpaymentCents" <= "amountCents");
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_amount_valid" CHECK ("amountCents" > 0);
ALTER TABLE "ClientFundsEntry" ADD CONSTRAINT "ClientFundsEntry_amount_valid" CHECK ("amountCents" <> 0);
ALTER TABLE "AdvisorCommissionLedger" ADD CONSTRAINT "AdvisorCommissionLedger_amount_valid" CHECK ("amountCents" <> 0);
ALTER TABLE "ManagerApproval"
  ADD CONSTRAINT "ManagerApproval_amounts_valid" CHECK ("amountCents" IS NULL OR "amountCents" >= 0),
  ADD CONSTRAINT "ManagerApproval_time_order" CHECK ("expiresAt" IS NULL OR "requestedAt" IS NULL OR "requestedAt" <= "expiresAt");
ALTER TABLE "Traveler" ADD CONSTRAINT "Traveler_passport_valid" CHECK ("dateOfBirth" IS NULL OR "passportExpiresAt" IS NULL OR "dateOfBirth" < "passportExpiresAt");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amounts_valid" CHECK ("amount" > 0 AND "refundedAmount" >= 0 AND "refundedAmount" <= "amount");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PaymentCollection" ADD CONSTRAINT "PaymentCollection_amounts_valid" CHECK ("amount" >= 0 AND "authorizedAmount" >= 0 AND "refundedAmount" >= 0);
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_amount_valid" CHECK ("amount" >= 0);

-- ISO currency everywhere money is stored
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "TripComponent" ADD CONSTRAINT "TripComponent_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "ClientInvoiceLine" ADD CONSTRAINT "ClientInvoiceLine_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "CommissionReceipt" ADD CONSTRAINT "CommissionReceipt_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "ClientFundsEntry" ADD CONSTRAINT "ClientFundsEntry_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "AdvisorCommissionLedger" ADD CONSTRAINT "AdvisorCommissionLedger_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "AgencySettings" ADD CONSTRAINT "AgencySettings_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');
ALTER TABLE "PaymentCollection" ADD CONSTRAINT "PaymentCollection_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$');

-- A trip's client funds never go below zero (receipts and reversals add, supplier payments, refunds and fee transfers subtract).
-- The trip row is locked so two concurrent entries are counted one after the other.
-- Prisma drops the constraint name from trigger errors, so the rule name leads the message.
CREATE FUNCTION travel_agent_client_funds_non_negative() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  balance NUMERIC;
BEGIN
  IF NEW."trip" IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM "Trip" WHERE "id" = NEW."trip" FOR UPDATE;
  SELECT COALESCE(SUM(CASE WHEN "entryType" IN ('receipt', 'reversal') THEN "amountCents" ELSE -"amountCents" END), 0) INTO balance
    FROM "ClientFundsEntry" WHERE "trip" = NEW."trip";
  IF balance < 0 THEN
    RAISE EXCEPTION 'ClientFundsEntry_balance_non_negative: balance would be %', balance USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "ClientFundsEntry_balance_non_negative"
  AFTER INSERT OR UPDATE OF "amountCents", "entryType", "trip" ON "ClientFundsEntry"
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION travel_agent_client_funds_non_negative();

-- Supplier payments never exceed the component's net cost. The component row is locked first.
CREATE FUNCTION travel_agent_supplier_payment_within_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cost INTEGER;
  paid BIGINT;
BEGIN
  IF NEW."component" IS NULL THEN RETURN NULL; END IF;
  SELECT "netCostCents" INTO cost FROM "TripComponent" WHERE "id" = NEW."component" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM("amountCents"), 0) INTO paid FROM "SupplierPayment" WHERE "component" = NEW."component";
  IF paid > cost THEN
    RAISE EXCEPTION 'SupplierPayment_within_net_cost: payments % exceed net cost %', paid, cost USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "SupplierPayment_within_net_cost"
  AFTER INSERT OR UPDATE OF "amountCents", "component" ON "SupplierPayment"
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION travel_agent_supplier_payment_within_cost();

-- Refunds never exceed the payment, in the payment's currency (payment row locked).
CREATE FUNCTION travel_agent_refund_within_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  paid RECORD;
  refunded BIGINT;
BEGIN
  IF NEW."payment" IS NULL THEN RETURN NULL; END IF;
  SELECT "amount", "currencyCode" INTO paid FROM "Payment" WHERE "id" = NEW."payment" FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NEW."currencyCode" <> paid."currencyCode" THEN
    RAISE EXCEPTION 'Refund_within_payment: refund currency % differs from payment currency %', NEW."currencyCode", paid."currencyCode" USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO refunded FROM "Refund"
    WHERE "payment" = NEW."payment" AND "status" IN ('processing', 'unknown', 'succeeded');
  IF refunded > paid."amount" THEN
    RAISE EXCEPTION 'Refund_within_payment: refunds % exceed payment %', refunded, paid."amount" USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Refund_within_payment"
  AFTER INSERT OR UPDATE OF "amount", "status", "payment", "currencyCode" ON "Refund"
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION travel_agent_refund_within_payment();

-- Uniqueness. Written as partial indexes (WHERE parent IS NOT NULL) or on expressions so Prisma, which cannot express them, leaves them alone.
CREATE UNIQUE INDEX "Proposal_trip_version_key" ON "Proposal"("trip", "version") WHERE "trip" IS NOT NULL;
CREATE UNIQUE INDEX "Proposal_one_accepted_per_trip" ON "Proposal"("trip") WHERE "trip" IS NOT NULL AND "status" = 'accepted';
CREATE UNIQUE INDEX "CommissionAllocation_receipt_component_key" ON "CommissionAllocation"("receipt", "component") WHERE "receipt" IS NOT NULL AND "component" IS NOT NULL;
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"(lower("name"));
