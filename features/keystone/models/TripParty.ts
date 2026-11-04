import { list } from "@keystone-6/core";
import { text, relationship } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { domainAccess } from "./domainFields";

/** One paying party inside a group trip (a family, a couple, the organizer). Created and changed only by operators. */
export const TripParty = list({
  access: { ...domainAccess("canManageTrips", true) },
  fields: {
    name: text({ validation: { isRequired: true } }),
    // sha256 of the party's own portal secret; unreadable through the API.
    portalToken: text({ access: { read: () => false, create: () => false, update: () => false } }),
    trip: relationship({ ref: "Trip.parties", many: false }),
    travelers: relationship({ ref: "Traveler.parties", many: true }),
    rooms: relationship({ ref: "TripRoom.party", many: true }),
    invoices: relationship({ ref: "ClientInvoice.party", many: true }),
    ...trackingFields,
  },
});
