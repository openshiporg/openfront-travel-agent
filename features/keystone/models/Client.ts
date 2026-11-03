import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Client = list({
  access: {...domainAccess("canManageClients", false),},
  fields: {
    name: text(),
    email: text(),
    phone: text(),
    address: text(),
    preferences: text(),
    source: text(),
    preferenceTags: json(),
    loyaltyNumbers: json(),
    marketingConsent: checkbox(),
    travelers: relationship({ ref: "Traveler.client", many: true }),
    inquiries: relationship({ ref: "Inquiry.client", many: true }),
    trips: relationship({ ref: "Trip.client", many: true }),
    lifetimeValueCents: virtual({field:graphql.field({type:graphql.Int,async resolve(item:any,_args,context:any){const rows=await context.prisma.clientInvoice.aggregate({where:{trip:{clientId:item.id}},_sum:{collectedCents:true}});return rows._sum.collectedCents||0;}})}),
    ...trackingFields,
  },
});
