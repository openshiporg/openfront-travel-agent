import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const CommissionAllocation = list({
  access: {...domainAccess("canManageCommissions", true),},
  fields: {
    amountCents: cents(),
    component: relationship({ ref: "TripComponent.allocations", many: false }),
    receipt: relationship({ ref: "CommissionReceipt.allocations", many: false }),
    currencyCode: currency(),
    overpaymentCents: integer({defaultValue:0,validation:{min:0}}),
    approval: relationship({ref:'ManagerApproval'}),
    ...trackingFields,
  },
});
