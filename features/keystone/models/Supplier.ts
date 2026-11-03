import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Supplier = list({
  access: {...domainAccess("canManageSuppliers", false),},
  fields: {
    name: text(),
    hostAgencyRelation: text(),
    bookingPortalUrl: text(),
    iataCliaNotes: text(),
    kind: state(["hotel", "cruise_line", "tour_operator", "dmc", "airline", "consolidator", "insurer", "transfer"]),
    defaultCommissionBps: bps(),
    commissionPaymentTermsDays: integer({defaultValue:30}),
    contacts: relationship({ ref: "SupplierContact.supplier", many: true }),
    proposalItems: relationship({ ref: "ProposalItem.supplier", many: true }),
    components: relationship({ ref: "TripComponent.supplier", many: true }),
    receipts: relationship({ ref: "CommissionReceipt.supplier", many: true }),
    ...trackingFields,
  },
});
