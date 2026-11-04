import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Document = list({
  access: {...domainAccess("canManageDocuments", true),filter:{query:({session}:any)=>session?.data.role?.canManageRoles?true:{trip:{advisor:{id:{equals:session?.itemId}}}}},},
  fields: {
    title: text(),
    storageKey: text({ access: { read: () => false, create: () => false, update: () => false } }),
    mimeType: text(),
    checksumSha256: text(),
    verifiedAt: timestamp(),
    byteSize: integer({validation:{min:1}}),
    kind: state(["passport", "visa", "insurance", "supplier_confirmation", "signed_terms"]),
    trip: relationship({ ref: "Trip.documents", many: false }),
    traveler: relationship({ ref: "Traveler.documents", many: false }),
    ...trackingFields,
  },
});
