import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const CommissionReceipt = list({
  access: {...domainAccess("canManageCommissions", true),},
  fields: {
    reference: text(),
    amountCents: cents(),
    receivedAt: timestamp(),
    supplier: relationship({ ref: "Supplier.receipts", many: false }),
    allocations: relationship({ ref: "CommissionAllocation.receipt", many: true }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
