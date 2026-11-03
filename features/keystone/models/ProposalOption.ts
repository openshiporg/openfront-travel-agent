import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ProposalOption = list({
  access: {...domainAccess("canManageTrips", true),},
  fields: {
    title: text(),
    proposal: relationship({ ref: "Proposal.options", many: false }),
    items: relationship({ ref: "ProposalItem.option", many: true }),
    sort: integer({defaultValue:0}),
    ...trackingFields,
  },
});
