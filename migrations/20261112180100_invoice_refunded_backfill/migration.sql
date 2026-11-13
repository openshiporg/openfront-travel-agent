-- Invoices whose every payment was fully refunded are refunded, not paid.
UPDATE "ClientInvoice" i SET "status" = 'refunded'
WHERE i."status" IN ('paid', 'partially_paid')
  AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."order" = i."id")
  AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."order" = i."id" AND p."status" IN ('succeeded', 'partially_refunded', 'pending', 'processing'))
  AND EXISTS (SELECT 1 FROM "Payment" p WHERE p."order" = i."id" AND p."status" = 'refunded');
