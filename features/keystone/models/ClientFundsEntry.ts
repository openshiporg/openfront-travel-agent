import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ClientFundsEntry = list({
  access: {...domainAccess("canManagePayments", true),},
  fields: {
    reference: text(),
    reason: text(),
    amountCents: cents(),
    occurredAt: timestamp(),
    trip: relationship({ ref: "Trip.funds", many: false }),
    component: relationship({ ref: "TripComponent.funds", many: false }),
    entryType: state(["receipt", "supplier_payment", "refund_to_client", "transfer_planning_fee", "reversal"]),
    reverses: relationship({ ref: "ClientFundsEntry.reversedBy", many: false }),
    reversedBy: relationship({ ref: "ClientFundsEntry.reverses", many: false }),
    entryKey: text({isIndexed:"unique"}),
    currencyCode: currency(),
    ...trackingFields,
  },
});
