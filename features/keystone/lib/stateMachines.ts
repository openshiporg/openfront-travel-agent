/**
 * One transitions map per lifecycle. Writers of a status (operators, webhooks, sweeps) assert the move here so an illegal
 * one is refused with one clear message. Keys are Prisma model names; a status missing from a map is terminal.
 */
export type Machine = Record<string, readonly string[]>;
export const MACHINES = {
 trip: {planning:['proposal_sent','cancelled'],proposal_sent:['accepted','cancelled'],accepted:['booked','cancelled'],booked:['final_payment_due','cancelled'],final_payment_due:['paid_in_full','cancelled'],paid_in_full:['traveling','cancelled'],traveling:['completed','cancelled'],completed:[],cancelled:[]},
 // superseded: a newer proposal was sent or the trip was cancelled. declined has no writer yet (clients cannot decline in the portal).
 proposal: {draft:['sent','superseded'],sent:['viewed','accepted','superseded','declined'],viewed:['accepted','superseded','declined'],accepted:[],superseded:[],declined:[]},
 // void only before any money is collected; paid can't be voided (refund instead).
 clientInvoice: {draft:['sent','void'],sent:['partially_paid','paid','void'],partially_paid:['partially_paid','paid'],paid:[],void:[]},
 // invoiced/paid are tracked for the planning fee only; a voided invoice puts the row back to due. cancelled -> due is a re-sync.
 paymentSchedule: {due:['invoiced','paid','cancelled'],invoiced:['paid','due','cancelled'],paid:[],cancelled:['due']},
 componentBooking: {quoted:['held','booked','cancelled'],held:['held','quoted','booked','cancelled'],booked:['ticketed','cancelled'],ticketed:['cancelled'],cancelled:[]},
 commission: {expected:['invoiced','received','short_paid','written_off'],invoiced:['received','short_paid','written_off'],short_paid:['received','short_paid','written_off'],received:[],written_off:[]},
 // new -> proposal: a trip was created straight from an unqualified lead. won -> lost: the accepted trip was cancelled.
 inquiry: {new:['qualifying','proposal','lost'],qualifying:['proposal','lost'],proposal:['won','lost'],won:['lost'],lost:['qualifying']},
 // completed/cancelled -> open re-arms a payment reminder when its schedule row comes back.
 task: {open:['completed','cancelled'],completed:['open'],cancelled:['open']},
 payment: {pending:['processing','succeeded','failed','cancelled','unknown'],processing:['succeeded','failed','cancelled','unknown'],authorized:['succeeded','failed','cancelled'],unknown:['succeeded','failed','cancelled'],succeeded:['partially_refunded','refunded'],partially_refunded:['partially_refunded','refunded'],refunded:[],failed:[],cancelled:[]},
 refund: {processing:['succeeded','failed','unknown'],unknown:['succeeded','failed','unknown'],succeeded:[],failed:[]},
 managerApproval: {requested:['approved','rejected'],approved:['consumed'],rejected:[],consumed:[]},
 paymentWebhookEvent: {received:['processed','ignored','failed'],failed:['processed','ignored','failed'],processed:[],ignored:[]},
} as const satisfies Record<string, Machine>;
export type MachineName = keyof typeof MACHINES;
export const canTransition=(m:MachineName,from:string,to:string)=>(MACHINES[m] as Machine)[from]?.includes(to)??false;
export function assertMove(m:MachineName,from:string,to:string){if(!canTransition(m,from,to))throw new Error(`A ${m.replace(/([A-Z])/g,' $1').toLowerCase()} cannot move from ${from.replace(/_/g,' ')} to ${to.replace(/_/g,' ')}`);}
export const nextStates=(m:MachineName,from:string):readonly string[]=>(MACHINES[m] as Machine)[from]??[];
export const terminalStates=(m:MachineName)=>Object.entries(MACHINES[m] as Machine).filter(([,v])=>!v.length).map(([k])=>k);
