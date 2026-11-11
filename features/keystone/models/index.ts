import { User } from "./User";
import { Role } from "./Role";
import { OAuthApp } from "./OAuthApp";
import { OAuthToken } from "./OAuthToken";
import { Client } from "./Client";
import { Traveler } from "./Traveler";
import { Inquiry } from "./Inquiry";
import { Destination } from "./Destination";
import { Trip } from "./Trip";
import { Proposal } from "./Proposal";
import { ProposalOption } from "./ProposalOption";
import { ProposalItem } from "./ProposalItem";
import { TripComponent } from "./TripComponent";
import { ItineraryDay } from "./ItineraryDay";
import { ItineraryItem } from "./ItineraryItem";
import { Supplier } from "./Supplier";
import { SupplierContact } from "./SupplierContact";
import { ClientInvoice } from "./ClientInvoice";
import { ClientInvoiceLine } from "./ClientInvoiceLine";
import { PaymentSchedule } from "./PaymentSchedule";
import { TripParty } from "./TripParty";
import { TripRoom } from "./TripRoom";
import { InsuranceOffer } from "./InsuranceOffer";
import { ClientFundsEntry } from "./ClientFundsEntry";
import { SupplierPayment } from "./SupplierPayment";
import { CommissionReceipt } from "./CommissionReceipt";
import { CommissionAllocation } from "./CommissionAllocation";
import { AdvisorCommissionLedger } from "./AdvisorCommissionLedger";
import { Document } from "./Document";
import { Task } from "./Task";
import { AgencySettings } from "./AgencySettings";
import { AuditEvent } from "./AuditEvent";
import { PaymentProvider } from "./PaymentProvider";
import { PaymentCollection } from "./PaymentCollection";
import { PaymentSession } from "./PaymentSession";
import { Payment } from "./Payment";
import { Refund } from "./Refund";
import { PaymentWebhookEvent } from "./PaymentWebhookEvent";
import { IdempotencyKey } from "./IdempotencyKey";
import { ManagerApproval } from "./ManagerApproval";
const rawModels = {
User,Role,OAuthApp,OAuthToken,Client,Traveler,Inquiry,Destination,Trip,Proposal,ProposalOption,ProposalItem,TripComponent,ItineraryDay,ItineraryItem,Supplier,SupplierContact,ClientInvoice,ClientInvoiceLine,TripParty,TripRoom,InsuranceOffer,PaymentSchedule,ClientFundsEntry,SupplierPayment,CommissionReceipt,CommissionAllocation,AdvisorCommissionLedger,Document,Task,AgencySettings,AuditEvent,PaymentProvider,PaymentCollection,PaymentSession,Payment,Refund,PaymentWebhookEvent,IdempotencyKey,ManagerApproval
};
// Sidebar visibility follows the role: a list whose query access denies the session is hidden from navigation
// (Keystone evaluates ui.isHidden per session in admin meta). Explicit isHidden settings are kept.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const models = Object.fromEntries(Object.entries(rawModels).map(([key, config]: [string, any]) => {
  const operationQuery = config?.access?.operation?.query;
  const filterQuery = config?.access?.filter?.query;
  if (typeof operationQuery !== 'function' && typeof filterQuery !== 'function') return [key, config];
  const existing = config?.ui?.isHidden;
  const isHidden = (args: any) => {
    if (existing === true || (typeof existing === 'function' && existing(args))) return true;
    if (typeof operationQuery === 'function' && !operationQuery(args)) return true;
    return typeof filterQuery === 'function' && filterQuery(args) === false;
  };
  return [key, { ...config, ui: { ...(config.ui ?? {}), isHidden } }];
})) as typeof rawModels;
/* eslint-enable @typescript-eslint/no-explicit-any */

export default models;
