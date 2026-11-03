import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Inquiry = list({
  access: {...domainAccess("canManageTrips", true),},
  fields: {
    name: text(),
    email: text(),
    phone: text(),
    destinations: text(),
    source: text(),
    budgetCents: cents(),
    travelWindowStart: timestamp(),
    travelWindowEnd: timestamp(),
    client: relationship({ ref: "Client.inquiries", many: false }),
    assignedAdvisor: relationship({ ref: "User.inquiries", many: false }),
    tripType: state(["honeymoon", "family", "group", "corporate", "cruise", "adventure"]),
    partySize: integer({defaultValue:1,validation:{min:1}}),
    status: state(["new", "qualifying", "proposal", "won", "lost"]),
    trips: relationship({ ref: "Trip.inquiry", many: true }),
    currencyCode: currency(),
    ...trackingFields,
  },
});
