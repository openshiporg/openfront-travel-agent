export function integerMoney(value: number, allowNegative = false) {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) throw new Error('Amount must be integer minor units');
  return value;
}
export function commissionCents(sellCents:number,bps:number) {
  integerMoney(sellCents); if(!Number.isInteger(bps)||bps<0||bps>10000)throw new Error('Invalid basis points');
  return Number(BigInt(sellCents)*BigInt(bps)/BigInt(10000));
}
export function advisorSplit(amount:number,hostBps:number) {
  const host=commissionCents(amount,hostBps); return {hostCents:host,advisorCents:amount-host};
}
export function penaltyCents(sellCents:number,startAt:Date,at:Date,schedule:{daysBefore:number;penaltyBps:number}[]) {
  const days=(startAt.getTime()-at.getTime())/86400000;
  const applicable=schedule.filter(x=>days<=x.daysBefore).sort((a,b)=>a.daysBefore-b.daysBefore)[0];
  return applicable?commissionCents(sellCents,applicable.penaltyBps):0;
}
export function fundsAfter(balance:number,delta:number) {
  integerMoney(balance);integerMoney(delta,true);const next=balance+delta;integerMoney(next,true);
  if(next<0)throw new Error('Insufficient trip client funds');return next;
}
export function supplierRemainder(netCost:number,paid:number,amount:number) {
  [netCost,paid,amount].forEach(x=>integerMoney(x));if(amount>netCost-paid)throw new Error('Supplier payment exceeds remaining net cost');return netCost-paid-amount;
}
export function fundsDelta(kind:string,amount:number) {
  integerMoney(amount,true);if(kind==='reversal')return amount;
  integerMoney(amount);if(kind==='receipt')return amount;
  if(['supplier_payment','refund_to_client','transfer_planning_fee'].includes(kind))return -amount;
  throw new Error('Invalid client funds entry type');
}
export const tripTransitions:Record<string,string[]>={planning:['proposal_sent','cancelled'],proposal_sent:['accepted','cancelled'],accepted:['booked','cancelled'],booked:['final_payment_due','cancelled'],final_payment_due:['paid_in_full','cancelled'],paid_in_full:['traveling','cancelled'],traveling:['completed','cancelled'],completed:[],cancelled:[]};
export function assertTransition(current:string,next:string,map=tripTransitions) {
 if(!map[current]?.includes(next))throw new Error(`Invalid transition ${current} → ${next}`);
}

/** Money still refundable on one payment: paid, less refunded, less refunds already reserved with the provider. */
export function refundableRemaining(paid: number, refunded: number, pending = 0) {
  [paid, refunded, pending].forEach((x) => integerMoney(x));
  const remaining = paid - refunded - pending;
  if (remaining < 0) throw new Error('Refunds exceed the amount paid');
  return remaining;
}
export function assertRefundAmount(amount: number, remaining: number) {
  integerMoney(amount);
  if (amount < 1) throw new Error('Refund amount must be positive');
  if (amount > remaining) throw new Error('Refund exceeds the amount still refundable');
  return remaining - amount;
}
/** A refund strictly above the threshold needs an independent approval. */
export function requiresApproval(amountCents: number, thresholdCents: number) {
  integerMoney(amountCents); integerMoney(thresholdCents);
  return amountCents > thresholdCents;
}
/** Part of a new allocation that lands above the expected commission for a component. */
export function overpaymentCents(expected: number, alreadyAllocated: number, amount: number) {
  [expected, alreadyAllocated, amount].forEach((x) => integerMoney(x));
  const over = Math.max(0, alreadyAllocated + amount - expected);
  return Math.min(over, amount);
}
/** Commission still unreceived on a component; the amount a write-off gives up. */
export function writeOffRemaining(expected: number, allocated: number) {
  [expected, allocated].forEach((x) => integerMoney(x));
  return Math.max(0, expected - allocated);
}
