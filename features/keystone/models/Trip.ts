import { list, graphql } from "@keystone-6/core";
import { text, integer, json, timestamp, checkbox, relationship, virtual } from "@keystone-6/core/fields";
import { trackingFields } from "./trackingFields";
import { passportStatus } from "../lib/passport-check";
import { cents, bps, currency, state, code, domainAccess, tripSum } from "./domainFields";
export const Trip = list({
  access: {...domainAccess("canManageTrips", true),},
  fields: {
    title: text(),
    // JSON text: [{id,status}] per traveler. Computed from the hidden expiry date so the date itself never leaves the server.
    passportChecks: virtual({field:graphql.field({type:graphql.String,async resolve(item:any,_a,context:any){
      const t=await context.prisma.trip.findUnique({where:{id:item.id},select:{startDate:true,endDate:true,travelers:{select:{id:true,passportExpiresAt:true}}}});
      return JSON.stringify((t?.travelers||[]).map((x:any)=>({id:x.id,status:passportStatus(x.passportExpiresAt,t)})));
    }})}),
    planningFeeCents: cents(),
    startDate: timestamp(),
    endDate: timestamp(),
    tripNumber: code("TR"),
    client: relationship({ ref: "Client.trips", many: false }),
    advisor: relationship({ ref: "User.trips", many: false }),
    inquiry: relationship({ ref: "Inquiry.trips", many: false }),
    destinations: relationship({ ref: "Destination.trips", many: true }),
    status: state(["planning", "proposal_sent", "accepted", "booked", "final_payment_due", "paid_in_full", "traveling", "completed", "cancelled"]),
    travelers: relationship({ ref: "Traveler.trips", many: true }),
    proposals: relationship({ ref: "Proposal.trip", many: true }),
    components: relationship({ ref: "TripComponent.trip", many: true }),
    days: relationship({ ref: "ItineraryDay.trip", many: true }),
    invoices: relationship({ ref: "ClientInvoice.trip", many: true }),
    schedule: relationship({ ref: "PaymentSchedule.trip", many: true }),
    funds: relationship({ ref: "ClientFundsEntry.trip", many: true }),
    tasks: relationship({ ref: "Task.trip", many: true }),
    documents: relationship({ ref: "Document.trip", many: true }),
    itineraryToken: text(),
    currencyCode: currency(),
    totalSellCents: tripSum("sell"),
    totalCollectedCents: tripSum("collected"),
    balanceDueCents: tripSum("balance"),
    expectedCommissionCents: tripSum("commission"),
    ...trackingFields,
  },
});
