import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const ItineraryDay = list({
  access: {...domainAccess("canManageTrips", false),},
  fields: {
    title: text(),
    date: timestamp(),
    trip: relationship({ ref: "Trip.days", many: false }),
    items: relationship({ ref: "ItineraryItem.day", many: true }),
    ...trackingFields,
  },
});
