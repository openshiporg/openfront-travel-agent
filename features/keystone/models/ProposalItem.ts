import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ProposalItem = list({
  access: {...domainAccess("canManageTrips", true),},
  fields: {
    title: text(),
    details: text(),
    image: text(),
    sellCents: cents(),
    option: relationship({ ref: "ProposalOption.items", many: false }),
    kind: state(["hotel", "cruise", "tour", "flight", "transfer", "rail", "insurance", "activity", "fee"]),
    supplier: relationship({ ref: "Supplier.proposalItems", many: false }),
    estimatedCommissionBps: bps(),
    sort: integer({defaultValue:0}),
    currencyCode: currency(),
    ...trackingFields,
  },
});
