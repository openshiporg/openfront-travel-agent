import { list } from "@keystone-6/core";
import { text, relationship } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { domainAccess } from "./domainFields";

/** One line of the rooming list. */
export const TripRoom = list({
  access: { ...domainAccess("canManageTrips", true) },
  fields: {
    label: text({ validation: { isRequired: true } }),
    roomType: text(),
    trip: relationship({ ref: "Trip.rooms", many: false }),
    party: relationship({ ref: "TripParty.rooms", many: false }),
    guests: relationship({ ref: "Traveler.rooms", many: true }),
    ...trackingFields,
  },
});
