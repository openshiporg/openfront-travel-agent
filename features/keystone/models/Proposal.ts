import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Proposal = list({
  access: {...domainAccess("canManageTrips", true),},
  fields: {
    introNote: text(),
    acceptedByName: text(),
    publicToken: text(),
    acceptedSnapshotHash: text(),
    sentAt: timestamp(),
    acceptedAt: timestamp(),
    acceptedSnapshot: json(),
    version: integer({defaultValue:1}),
    status: state(["draft", "sent", "viewed", "accepted", "superseded", "declined"]),
    trip: relationship({ ref: "Trip.proposals", many: false }),
    options: relationship({ ref: "ProposalOption.proposal", many: true }),
    ...trackingFields,
  },
});
