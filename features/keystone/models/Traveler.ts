import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Traveler = list({
  access: {...domainAccess("canManageClients", true),filter:{query:({session}:any)=>session?.data.role?.canManageRoles?true:{trips:{some:{advisor:{id:{equals:session?.itemId}}}}}},},
  fields: {
    firstName: text(),
    lastName: text(),
    knownTravelerNumber: text({access:{read:()=>false,create:()=>false,update:()=>false}}),
    nationality: text(),
    notes: text(),
    dateOfBirth: timestamp({access:{read:()=>false,create:()=>false,update:()=>false}}),
    passportExpiresAt: timestamp({access:{read:()=>false,create:()=>false,update:()=>false}}),
    passportOnFile: checkbox(),
    client: relationship({ ref: "Client.travelers", many: false }),
    trips: relationship({ ref: "Trip.travelers", many: true }),
    components: relationship({ ref: "TripComponent.travelers", many: true }),
    documents: relationship({ ref: "Document.traveler", many: true }),
    ...trackingFields,
  },
});
