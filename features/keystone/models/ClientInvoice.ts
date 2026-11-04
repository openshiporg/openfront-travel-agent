import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ClientInvoice = list({
  access: {...domainAccess("canManagePayments", true),},
  fields: {
    publicToken: text(),
    totalCents: cents(),
    collectedCents: cents(),
    dueAt: timestamp(),
    number: code("INV"),
    trip: relationship({ ref: "Trip.invoices", many: false }),
    party: relationship({ ref: "TripParty.invoices", many: false }),
    lines: relationship({ ref: "ClientInvoiceLine.invoice", many: true }),
    status: state(["draft", "sent", "partially_paid", "paid", "void"]),
    paymentCollection: relationship({ ref: "PaymentCollection.invoice", many: false }),
    payments: relationship({ ref: "Payment.order", many: true }),
    refunds: relationship({ ref: "Refund.order", many: true }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
