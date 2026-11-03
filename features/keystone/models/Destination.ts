import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Destination = list({
  access: {...domainAccess("canManageTrips", false),},
  fields: {
    name: text(),
    slug: text(),
    country: text(),
    specialty: text(),
    trips: relationship({ ref: "Trip.destinations", many: true }),
    ...trackingFields,
  },
});
