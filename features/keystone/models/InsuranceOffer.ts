import { list } from "@keystone-6/core";
import { text, timestamp, relationship } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { state, domainAccess } from "./domainFields";

/** Append-only liability record: one row per answer. Nothing edits or deletes a row; the latest row is the current answer. */
export const InsuranceOffer = list({
  access: { ...domainAccess("canManageTrips", true) },
  fields: {
    trip: relationship({ ref: "Trip.insuranceOffers", many: false }),
    traveler: relationship({ ref: "Traveler.insuranceOffers", many: false }),
    decision: state(["offered", "accepted", "declined"]),
    waiverNote: text(),
    recordedAt: timestamp(),
    recordedBy: relationship({ ref: "User.insuranceOffers", many: false }),
    ...trackingFields,
  },
});
