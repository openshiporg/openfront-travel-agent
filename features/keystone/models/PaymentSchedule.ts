import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const PaymentSchedule = list({
  access: {...domainAccess("canManagePayments", true),},
  fields: {
    scheduleKey: text({isIndexed:"unique",validation:{isRequired:true}}),
    amountCents: cents(),
    dueAt: timestamp(),
    kind: state(["planning_fee", "component_deposit", "component_final"]),
    trip: relationship({ ref: "Trip.schedule", many: false }),
    component: relationship({ ref: "TripComponent.schedule", many: false }),
    status: state(["due", "invoiced", "paid", "cancelled"]),
    currencyCode: currency(),
    ...trackingFields,
  },
});
