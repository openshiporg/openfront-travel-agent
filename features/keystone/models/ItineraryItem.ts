import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ItineraryItem = list({
  access: {...domainAccess("canManageTrips", false),},
  fields: {
    title: text(),
    time: text(),
    location: text(),
    notes: text(),
    day: relationship({ ref: "ItineraryDay.items", many: false }),
    component: relationship({ ref: "TripComponent.itineraryItems", many: false }),
    sort: integer({defaultValue:0}),
    ...trackingFields,
  },
});
