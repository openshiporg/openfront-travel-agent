import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const AdvisorCommissionLedger = list({
  access: {...domainAccess("canManageCommissions", true),},
  fields: {
    reference: text(),
    reason: text(),
    amountCents: cents(),
    occurredAt: timestamp(),
    entryType: state(["allocation", "reversal"]),
    advisor: relationship({ ref: "User.commissionLedger", many: false }),
    component: relationship({ ref: "TripComponent.advisorLedger", many: false }),
    reverses: relationship({ ref: "AdvisorCommissionLedger.reversedBy", many: false }),
    reversedBy: relationship({ ref: "AdvisorCommissionLedger.reverses", many: false }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
