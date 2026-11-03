import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const SupplierPayment = list({
  access: {...domainAccess("canManageSuppliers", true),},
  fields: {
    method: text(),
    reference: text(),
    amountCents: cents(),
    paidAt: timestamp(),
    component: relationship({ ref: "TripComponent.supplierPayments", many: false }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
