import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ClientInvoiceLine = list({
  access: {...domainAccess("canManagePayments", true),},
  fields: {
    description: text(),
    amountCents: cents(),
    unitPriceCents: cents(),
    feesCents: cents(),
    taxCents: cents(),
    snapshot: json(),
    quantity: integer({defaultValue:1,validation:{min:1}}),
    kind: state(["planning_fee", "component_deposit", "component_final", "insurance"]),
    invoice: relationship({ ref: "ClientInvoice.lines", many: false }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
