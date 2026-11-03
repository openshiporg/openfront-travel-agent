import {randomBytes,createHash} from 'node:crypto';
import {permissions, type Permission} from '../access';
import {getOrCreateIdempotencyAttempt,updateIdempotencyAttempt} from '../utils/idempotency';
import {commissionCents,advisorSplit,penaltyCents,fundsAfter,supplierRemainder,fundsDelta,integerMoney,assertTransition} from '../lib/travel-money';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const code=(prefix:string)=>`${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
export async function lockTransactionKey(tx:any,key:string){await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS acquired`;}
function authorize(context:any,permission:Permission){if(!permissions[permission]({session:context.session}))throw new Error('Not authorized');}
async function audit(tx:any,context:any,action:string,list:string,id:string,before:any,after:any){await tx.auditEvent.create({data:{actorId:context.session?.itemId||null,action,targetList:list,targetId:id,before:before?JSON.parse(JSON.stringify(before)):undefined,after:after?JSON.parse(JSON.stringify(after)):undefined,requestId:randomBytes(12).toString('hex')}});}
async function command(context:any,operation:string,input:any,permission:Permission,run:(tx:any)=>Promise<any>){
 authorize(context,permission);if(!input.idempotencyKey?.trim())throw new Error('Idempotency key required');
 return context.prisma.$transaction(async(tx:any)=>{
  await lockTransactionKey(tx,`travel-idempotency:${input.idempotencyKey}`);
  const {attempt,replay}=await getOrCreateIdempotencyAttempt(tx,{key:input.idempotencyKey,requestPath:operation,requestParams:{...input,actorId:context.session.itemId}});
  if(replay&&attempt.recoveryPoint==='completed')return attempt.responseBody;
  const result=await run(tx);const json=JSON.parse(JSON.stringify(result));
  await updateIdempotencyAttempt(tx,attempt.id,'completed',json,200);return json;
 },{timeout:20000});
}
async function trip(tx:any,id:string){await lockTransactionKey(tx,`travel-trip:${id}`);const row=await tx.trip.findUnique({where:{id}});if(!row)throw new Error('Trip not found');return row;}
async function transition(tx:any,context:any,row:any,next:string){assertTransition(row.status,next);const changed=await tx.trip.updateMany({where:{id:row.id,status:row.status},data:{status:next}});if(changed.count!==1)throw new Error('Trip changed concurrently');await audit(tx,context,'transition','Trip',row.id,{status:row.status},{status:next});}
async function postFunds(tx:any,context:any,input:any){
 await trip(tx,input.tripId);const entries=await tx.clientFundsEntry.findMany({where:{tripId:input.tripId}});const balance=entries.reduce((n:number,e:any)=>n+fundsDelta(e.entryType,e.amountCents),0);
 const amount=integerMoney(input.amountCents,input.entryType==='reversal');fundsAfter(balance,fundsDelta(input.entryType,amount));
 if(input.componentId){const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c||c.tripId!==input.tripId||c.paymentModel!=='agency_collects')throw new Error('Component is not collected by this trip');}
 if(input.entryType==='transfer_planning_fee'){
  const lines=await tx.clientInvoiceLine.aggregate({where:{invoice:{tripId:input.tripId,status:'paid'},kind:'planning_fee'},_sum:{amountCents:true}});
  const prior=entries.filter((e:any)=>e.entryType==='transfer_planning_fee').reduce((n:number,e:any)=>n+e.amountCents,0);
  if(amount+prior>(lines._sum.amountCents||0))throw new Error('Planning fee transfer exceeds paid planning invoices');
 }
 const row=await tx.clientFundsEntry.create({data:{tripId:input.tripId,componentId:input.componentId||null,entryType:input.entryType,amountCents:amount,currencyCode:input.currencyCode||'USD',reference:input.reference||'',reason:input.reason||'',occurredAt:new Date(),entryKey:input.entryKey||randomBytes(16).toString('hex'),reversesId:input.reversesId||null}});
 await audit(tx,context,'post','ClientFundsEntry',row.id,null,{entryType:row.entryType,amountCents:row.amountCents});return row;
}
export const operators:Record<string,(context:any,input:any)=>Promise<any>>={
 createTripFromInquiry:(context,input)=>command(context,'createTripFromInquiry',input,'canManageTrips',async tx=>{
 const inquiry=await tx.inquiry.findUnique({where:{id:input.inquiryId}});if(!inquiry)throw new Error('Inquiry not found');await lockTransactionKey(tx,`inquiry:${inquiry.id}`);
 let clientId=inquiry.clientId;if(!clientId)clientId=(await tx.client.create({data:{name:inquiry.name,email:inquiry.email,phone:inquiry.phone}})).id;
 const row=await tx.trip.create({data:{tripNumber:code('TR'),title:input.title||inquiry.destinations,clientId,inquiryId:inquiry.id,advisorId:inquiry.assignedAdvisorId||context.session.itemId,startDate:inquiry.travelWindowStart,endDate:inquiry.travelWindowEnd,status:'planning',currencyCode:'USD'}});
 await tx.inquiry.update({where:{id:inquiry.id},data:{clientId,status:'proposal'}});await audit(tx,context,'create','Trip',row.id,null,row);return row;
 }),
 buildProposal:(context,input)=>command(context,'buildProposal',input,'canManageTrips',async tx=>{
 await trip(tx,input.tripId);const prior=await tx.proposal.aggregate({where:{tripId:input.tripId},_max:{version:true}});
 const p=await tx.proposal.create({data:{tripId:input.tripId,version:(prior._max.version||0)+1,status:'draft',introNote:input.introNote||''}});
 if(!Array.isArray(input.options)||!input.options.length)throw new Error('Proposal options required');
 for(const [sort,option] of input.options.entries()){
 const o=await tx.proposalOption.create({data:{proposalId:p.id,title:option.title,sort}});
 for(const [index,item] of (option.items||[]).entries()){integerMoney(item.sellCents);commissionCents(item.sellCents,item.estimatedCommissionBps||0);await tx.proposalItem.create({data:{optionId:o.id,title:item.title,kind:item.kind,supplierId:item.supplierId||null,details:item.details||'',sellCents:item.sellCents,estimatedCommissionBps:item.estimatedCommissionBps||0,sort:index,currencyCode:input.currencyCode||'USD'}});}
 }await audit(tx,context,'build','Proposal',p.id,null,p);return p;
 }),
 sendProposal:(context,input)=>command(context,'sendProposal',input,'canManageTrips',async tx=>{
 const p=await tx.proposal.findUnique({where:{id:input.proposalId}});if(!p||p.status!=='draft')throw new Error('Only draft proposals may be sent');const t=await trip(tx,p.tripId);
 const token=randomBytes(32).toString('base64url');await tx.proposal.updateMany({where:{tripId:p.tripId,status:{in:['sent','viewed']}},data:{status:'superseded'}});
 await tx.proposal.update({where:{id:p.id},data:{status:'sent',sentAt:new Date(),publicToken:hash(token)}});if(t.status==='planning')await transition(tx,context,t,'proposal_sent');
 await audit(tx,context,'send','Proposal',p.id,{status:p.status},{status:'sent'});return {id:p.id,token};
 }),
 bookComponent:(context,input)=>command(context,'bookComponent',input,'canManageTrips',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c)throw new Error('Component not found');const t=await trip(tx,c.tripId);if(!['quoted','held'].includes(c.bookingStatus))throw new Error('Component cannot be booked');
 integerMoney(input.netCostCents);const commission=commissionCents(c.sellCents,input.commissionBps??c.commissionBps);
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'booked',confirmationNumber:input.confirmationNumber,netCostCents:input.netCostCents,paymentModel:input.paymentModel||c.paymentModel,commissionBps:input.commissionBps??c.commissionBps,commissionCents:commission,purchaseSnapshot:{title:c.title,sellCents:c.sellCents,netCostCents:input.netCostCents,quantity:1,feesCents:0,taxCents:0,currencyCode:c.currencyCode,commissionCents:commission}}});
 if(t.status==='accepted')await transition(tx,context,t,'booked');await audit(tx,context,'book','TripComponent',row.id,c,row);return row;
 }),
 generatePaymentSchedule:(context,input)=>command(context,'generatePaymentSchedule',input,'canManagePayments',async tx=>{
 const t=await trip(tx,input.tripId);const components=await tx.tripComponent.findMany({where:{tripId:t.id,paymentModel:'agency_collects',bookingStatus:{not:'cancelled'}}});const rows:any[]=[];
 if(t.planningFeeCents>0)rows.push({scheduleKey:`${t.id}:planning_fee`,tripId:t.id,kind:'planning_fee',amountCents:t.planningFeeCents,dueAt:t.createdAt});
 for(const c of components){if(c.depositCents&&c.depositDueAt)rows.push({scheduleKey:`${c.id}:component_deposit`,tripId:t.id,componentId:c.id,kind:'component_deposit',amountCents:c.depositCents,dueAt:c.depositDueAt});if(c.finalDueAt)rows.push({scheduleKey:`${c.id}:component_final`,tripId:t.id,componentId:c.id,kind:'component_final',amountCents:c.sellCents-c.depositCents,dueAt:c.finalDueAt});}
 for(const row of rows){await tx.paymentSchedule.upsert({where:{scheduleKey:row.scheduleKey},update:{},create:{...row,currencyCode:t.currencyCode,status:'due'}});await tx.task.upsert({where:{taskKey:`reminder:${row.scheduleKey}`},update:{},create:{taskKey:`reminder:${row.scheduleKey}`,tripId:t.id,assigneeId:t.advisorId,title:row.kind,type:row.kind==='component_final'?'final_due':'deposit_due',dueAt:new Date(new Date(row.dueAt).getTime()-7*86400000),status:'open'}});}
 return {count:rows.length};
 }),
 issueClientInvoice:(context,input)=>command(context,'issueClientInvoice',input,'canManagePayments',async tx=>{
 const t=await trip(tx,input.tripId);if(!input.lines?.length)throw new Error('Invoice lines required');let total=0;
 for(const l of input.lines){integerMoney(l.amountCents);total+=l.amountCents;}integerMoney(total);const token=randomBytes(32).toString('base64url');
 const collection=await tx.paymentCollection.create({data:{amount:total,currencyCode:t.currencyCode}});
 const invoice=await tx.clientInvoice.create({data:{tripId:t.id,number:code('INV'),status:'sent',totalCents:total,collectedCents:0,dueAt:input.dueAt?new Date(input.dueAt):new Date(),publicToken:hash(token),currencyCode:t.currencyCode,paymentCollection:{connect:{id:collection.id}}}});
 for(const l of input.lines)await tx.clientInvoiceLine.create({data:{invoiceId:invoice.id,description:l.description,amountCents:l.amountCents,unitPriceCents:l.amountCents,quantity:1,feesCents:0,taxCents:0,kind:l.kind,currencyCode:t.currencyCode,snapshot:{description:l.description,amountCents:l.amountCents,quantity:1,feesCents:0,taxCents:0,kind:l.kind}}});
 await audit(tx,context,'invoice','ClientInvoice',invoice.id,null,invoice);return {id:invoice.id,number:invoice.number,token};
 }),
 recordClientPayment:(context,input)=>command(context,'recordClientPayment',input,'canManagePayments',async tx=>{
 const invoice=await tx.clientInvoice.findUnique({where:{id:input.invoiceId}});if(!invoice)throw new Error('Invoice not found');await trip(tx,invoice.tripId);integerMoney(input.amountCents);if(input.amountCents<1||invoice.status==='void'||input.amountCents>invoice.totalCents-invoice.collectedCents)throw new Error('Invalid payment amount');
 if(!['check','wire','cash'].includes(input.method))throw new Error('Manual payments require check, wire, or cash evidence');if(!input.reference?.trim())throw new Error('Payment reference required');
 const p=await tx.payment.create({data:{orderId:invoice.id,paymentCollectionId:invoice.paymentCollectionId,amount:input.amountCents,currencyCode:invoice.currencyCode,status:'succeeded',paymentMethod:'cash',idempotencyKey:input.idempotencyKey,notes:`${input.method}: ${input.reference}`,processedAt:new Date(),processedById:context.session.itemId}});
 await tx.clientInvoice.update({where:{id:invoice.id},data:{collectedCents:invoice.collectedCents+input.amountCents,status:invoice.collectedCents+input.amountCents===invoice.totalCents?'paid':'partially_paid'}});
 await postFunds(tx,context,{tripId:invoice.tripId,entryType:'receipt',amountCents:input.amountCents,currencyCode:invoice.currencyCode,reference:p.id});await audit(tx,context,'receive','Payment',p.id,null,{amountCents:input.amountCents});return {id:p.id};
 }),
 recordSupplierPayment:(context,input)=>command(context,'recordSupplierPayment',input,'canManagePayments',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c)throw new Error('Component not found');await trip(tx,c.tripId);const paid=await tx.supplierPayment.aggregate({where:{componentId:c.id},_sum:{amountCents:true}});supplierRemainder(c.netCostCents,paid._sum.amountCents||0,input.amountCents);
 const e=await postFunds(tx,context,{...input,tripId:c.tripId,entryType:'supplier_payment',currencyCode:c.currencyCode});const row=await tx.supplierPayment.create({data:{componentId:c.id,amountCents:input.amountCents,paidAt:new Date(),method:input.method,reference:input.reference,currencyCode:c.currencyCode}});return {id:row.id,entryId:e.id};
 }),
 recordCommissionReceipt:(context,input)=>command(context,'recordCommissionReceipt',input,'canManageCommissions',async tx=>{
 integerMoney(input.amountCents);if(!input.allocations?.length||input.allocations.reduce((n:number,a:any)=>n+a.amountCents,0)!==input.amountCents)throw new Error('Receipt allocations must equal amount');
 const settings=await tx.agencySettings.findFirst();const receipt=await tx.commissionReceipt.create({data:{supplierId:input.supplierId,amountCents:input.amountCents,receivedAt:new Date(),reference:input.reference,currencyCode:input.currencyCode||'USD'}});
 for(const a of [...input.allocations].sort((a:any,b:any)=>a.componentId.localeCompare(b.componentId))){integerMoney(a.amountCents);const c=await tx.tripComponent.findUnique({where:{id:a.componentId}});if(!c||c.supplierId!==input.supplierId||c.currencyCode!==(input.currencyCode||'USD'))throw new Error('Allocation supplier/currency mismatch');const t=await trip(tx,c.tripId);const prior=await tx.commissionAllocation.aggregate({where:{componentId:c.id},_sum:{amountCents:true}});const collected=(prior._sum.amountCents||0)+a.amountCents;if(collected>c.commissionCents)throw new Error('Overpayment requires independent approval');
 await tx.commissionAllocation.create({data:{receiptId:receipt.id,componentId:c.id,amountCents:a.amountCents,currencyCode:c.currencyCode}});await tx.tripComponent.update({where:{id:c.id},data:{commissionStatus:collected===c.commissionCents?'received':'short_paid'}});
 const split=advisorSplit(a.amountCents,settings?.hostAgencySplitBps||0);await tx.advisorCommissionLedger.create({data:{advisorId:t.advisorId,componentId:c.id,entryType:'allocation',amountCents:split.advisorCents,currencyCode:c.currencyCode,reference:receipt.id,occurredAt:new Date()}});
 if(collected<c.commissionCents)await tx.task.upsert({where:{taskKey:`short-paid:${c.id}`},update:{status:'open'},create:{taskKey:`short-paid:${c.id}`,tripId:t.id,assigneeId:t.advisorId,title:`Commission short-paid: ${c.title}`,type:'commission_overdue',status:'open',dueAt:new Date()}});
 }await audit(tx,context,'receive','CommissionReceipt',receipt.id,null,{amountCents:input.amountCents});return {id:receipt.id};
 }),
 postClientFundsEntry:(context,input)=>command(context,'postClientFundsEntry',input,'canManagePayments',async tx=>{
 if(!['transfer_planning_fee'].includes(input.entryType))throw new Error('Receipts, supplier payments, refunds and reversals require their dedicated mutation');return postFunds(tx,context,input);
 }),
 reverseEntry:(context,input)=>command(context,'reverseEntry',input,'canManagePayments',async tx=>{
 const e=await tx.clientFundsEntry.findUnique({where:{id:input.entryId}});if(!e||e.entryType==='reversal')throw new Error('Entry cannot be reversed');await trip(tx,e.tripId);if(await tx.clientFundsEntry.findFirst({where:{reversesId:e.id}}))throw new Error('Entry already reversed');
 // External cash cannot be reversed by bookkeeping alone.
 if(['receipt','supplier_payment','refund_to_client'].includes(e.entryType))throw new Error('External funds require a corresponding reconciled cash movement');
 return postFunds(tx,context,{tripId:e.tripId,componentId:e.componentId,entryType:'reversal',amountCents:-fundsDelta(e.entryType,e.amountCents),currencyCode:e.currencyCode,reversesId:e.id,reason:input.reason});
 }),
 cancelComponent:(context,input)=>command(context,'cancelComponent',input,'canManageTrips',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c||c.bookingStatus==='cancelled')throw new Error('Component not cancellable');await trip(tx,c.tripId);const penalty=penaltyCents(c.sellCents,c.startAt||new Date(),new Date(),Array.isArray(c.cancelPenaltySchedule)?c.cancelPenaltySchedule:[]);
 if(input.refundCents)throw new Error('Refund requires original-tender payment reconciliation and independent approval');
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'cancelled'}});await audit(tx,context,'cancel','TripComponent',c.id,{bookingStatus:c.bookingStatus},{bookingStatus:'cancelled',penaltyCents:penalty});return {id:row.id,penaltyCents:penalty,refundableCents:Math.max(0,c.sellCents-penalty)};
 }),
 transitionTrip:(context,input)=>command(context,'transitionTrip',input,'canManageTrips',async tx=>{const t=await trip(tx,input.tripId);await transition(tx,context,t,input.status);return {id:t.id,status:input.status};}),
 sweepTripDates:(context,input)=>command(context,'sweepTripDates',input,'canManageTrips',async tx=>{const rows=await tx.trip.findMany({where:{status:{in:['paid_in_full','traveling']}}});let count=0;for(const row of rows){const t=await trip(tx,row.id);if(t.status==='paid_in_full'&&t.startDate&&t.startDate<=new Date()){await transition(tx,context,t,'traveling');count++;}else if(t.status==='traveling'&&t.endDate&&t.endDate<new Date()){await transition(tx,context,t,'completed');count++;}}return {count};}),
};
export async function submitInquiry(_root:any,{input}:any,context:any){
 if(!input.name?.trim()||!/^\S+@\S+\.\S+$/.test(input.email||''))throw new Error('Name and valid email required');
 const row=await context.prisma.inquiry.create({data:{name:input.name.slice(0,200),email:input.email.slice(0,254),phone:input.phone?.slice(0,80)||'',destinations:input.destinations?.slice(0,2000)||'',tripType:input.tripType||'family',partySize:input.partySize||1,budgetCents:integerMoney(input.budgetCents||0),status:'new',source:'website',currencyCode:'USD'}});return {id:row.id};
}
async function proposalForToken(context:any,token:string){if(!token||token.length<32)throw new Error('Proposal not found');const p=await context.prisma.proposal.findFirst({where:{publicToken:hash(token)},include:{options:{include:{items:{orderBy:{sort:'asc'}}}},trip:{select:{id:true,title:true,status:true,currencyCode:true}}}});if(!p||!['sent','viewed','accepted'].includes(p.status))throw new Error('Proposal not found');return p;}
export async function viewProposal(_root:any,{token}:any,context:any){const p=await proposalForToken(context,token);if(p.status==='sent')await context.prisma.$transaction(async(tx:any)=>{const r=await tx.proposal.updateMany({where:{id:p.id,status:'sent'},data:{status:'viewed'}});if(r.count)await audit(tx,context,'view','Proposal',p.id,{status:'sent'},{status:'viewed'});});return {id:p.id,version:p.version,status:p.status,introNote:p.introNote,trip:p.trip,options:p.options.map((o:any)=>({id:o.id,title:o.title,items:o.items.map((i:any)=>({id:i.id,title:i.title,details:i.details,kind:i.kind,sellCents:i.sellCents,currencyCode:i.currencyCode}))}))};}
export async function acceptProposal(_root:any,{token,optionId,name,idempotencyKey}:any,context:any){
 const proof=await proposalForToken(context,token);if(!name?.trim()||!idempotencyKey)throw new Error('Name and idempotency key required');
 return context.prisma.$transaction(async(tx:any)=>{await trip(tx,proof.tripId);const p=await tx.proposal.findUnique({where:{id:proof.id},include:{options:{include:{items:true}}}});if(p.status==='accepted')return {id:p.id,status:'accepted'};if(!['sent','viewed'].includes(p.status))throw new Error('Proposal no longer available');const option=p.options.find((o:any)=>o.id===optionId);if(!option)throw new Error('Option not found');
 const snapshot={proposalId:p.id,version:p.version,optionId,name:name.trim(),acceptedAt:new Date().toISOString(),items:option.items.map((i:any)=>({title:i.title,details:i.details,kind:i.kind,sellCents:i.sellCents,quantity:1,feesCents:0,taxCents:0,currencyCode:i.currencyCode,supplierId:i.supplierId,estimatedCommissionBps:i.estimatedCommissionBps}))};
 await tx.proposal.update({where:{id:p.id},data:{status:'accepted',acceptedByName:name.trim(),acceptedAt:new Date(),acceptedSnapshot:snapshot,acceptedSnapshotHash:hash(JSON.stringify(snapshot))}});
 for(const i of option.items)await tx.tripComponent.create({data:{tripId:p.tripId,supplierId:i.supplierId,title:i.title,kind:i.kind,sellCents:i.sellCents,currencyCode:i.currencyCode,commissionBps:i.estimatedCommissionBps,commissionCents:commissionCents(i.sellCents,i.estimatedCommissionBps),bookingStatus:'quoted',paymentModel:'client_pays_supplier',commissionStatus:'expected',purchaseSnapshot:snapshot.items.find((x:any)=>x.title===i.title)}});
 const t=await tx.trip.findUnique({where:{id:p.tripId}});if(t.status==='proposal_sent')await transition(tx,context,t,'accepted');await audit(tx,context,'accept','Proposal',p.id,{status:p.status},{status:'accepted',snapshotHash:hash(JSON.stringify(snapshot))});return {id:p.id,status:'accepted'};
 });
}
export async function viewItinerary(_root:any,{token}:any,context:any){if(!token||token.length<32)throw new Error('Itinerary not found');const t=await context.prisma.trip.findFirst({where:{itineraryToken:hash(token)},select:{tripNumber:true,title:true,startDate:true,endDate:true,days:{orderBy:{date:'asc'},select:{date:true,title:true,items:{orderBy:{sort:'asc'},select:{title:true,time:true,location:true,notes:true}}}}}});if(!t)throw new Error('Itinerary not found');return t;}
const stripeProvider={id:'stripe-test',code:'pp_stripe',createPaymentFunction:'stripe',getPaymentStatusFunction:'stripe',capturePaymentFunction:'stripe',refundPaymentFunction:'stripe',generatePaymentLinkFunction:'stripe',handleWebhookFunction:'stripe',credentials:{}};
async function invoiceForToken(context:any,token:string){if(!token||token.length<32)throw new Error('Invoice not found');const i=await context.prisma.clientInvoice.findFirst({where:{publicToken:hash(token)}});if(!i||['void','paid'].includes(i.status))throw new Error('Invoice not payable');return i;}
export async function payInvoice(_root:any,{token,idempotencyKey}:any,context:any){
 const {createPayment}=await import('../utils/paymentProviderAdapter');const inv=await invoiceForToken(context,token);if(!idempotencyKey)throw new Error('Idempotency key required');
 const amount=inv.totalCents-inv.collectedCents;const existing=await context.prisma.paymentSession.findUnique({where:{idempotencyKey:`inv:${inv.id}:${idempotencyKey}`}});
 if(existing)return {clientSecret:(existing.data as any).clientSecret,paymentIntentId:(existing.data as any).paymentIntentId,amountCents:existing.amount};
 const intent=await createPayment({provider:stripeProvider,order:{id:inv.id,orderNumber:inv.number},amount,currency:inv.currencyCode,idempotencyKey:`inv:${inv.id}:${idempotencyKey}`});
 await context.prisma.paymentSession.create({data:{amount,currencyCode:inv.currencyCode,idempotencyKey:`inv:${inv.id}:${idempotencyKey}`,paymentCollectionId:inv.paymentCollectionId,isSelected:true,isInitiated:true,data:{clientSecret:intent.clientSecret,paymentIntentId:intent.paymentIntentId}}});
 return {clientSecret:intent.clientSecret,paymentIntentId:intent.paymentIntentId,amountCents:amount};
}
export async function confirmInvoicePayment(_root:any,{token,paymentIntentId}:any,context:any){
 const {getPaymentStatus}=await import('../utils/paymentProviderAdapter');const inv=await invoiceForToken(context,token);
 const session=await context.prisma.paymentSession.findFirst({where:{paymentCollectionId:inv.paymentCollectionId,data:{path:['paymentIntentId'],equals:paymentIntentId}}});if(!session)throw new Error('Payment not found');
 const status=await getPaymentStatus({provider:stripeProvider,paymentId:paymentIntentId});if(status.status!=='succeeded'||status.amount!==session.amount||status.currencyCode!==inv.currencyCode)return {status:status.status};
 return context.prisma.$transaction(async(tx:any)=>{await trip(tx,inv.tripId);const cur=await tx.clientInvoice.findUnique({where:{id:inv.id}});
  if(await tx.payment.findUnique({where:{idempotencyKey:`stripe:${paymentIntentId}`}}))return {status:'succeeded',invoiceStatus:cur.status};
  const p=await tx.payment.create({data:{orderId:inv.id,paymentCollectionId:inv.paymentCollectionId,amount:session.amount,currencyCode:inv.currencyCode,status:'succeeded',idempotencyKey:`stripe:${paymentIntentId}`,providerPaymentId:paymentIntentId,processedAt:new Date()}});
  const collected=cur.collectedCents+session.amount;await tx.clientInvoice.update({where:{id:inv.id},data:{collectedCents:collected,status:collected>=cur.totalCents?'paid':'partially_paid'}});
  await postFunds(tx,context,{tripId:inv.tripId,entryType:'receipt',amountCents:session.amount,currencyCode:inv.currencyCode,reference:p.id,entryKey:`receipt:${p.id}`});
  await audit(tx,context,'receive','Payment',p.id,null,{amountCents:session.amount});return {status:'succeeded',invoiceStatus:collected>=cur.totalCents?'paid':'partially_paid',number:inv.number};});
}
