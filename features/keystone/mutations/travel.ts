import { GraphQLError } from 'graphql';
import {randomBytes,createHash} from 'node:crypto';
import {parseDecision,parseWaiverNote} from '../lib/insurance-offer';
import {guardKeystonePrismaResults} from '../lib/prisma-result';
import {permissions, type Permission} from '../access';
import {getOrCreateIdempotencyAttempt,updateIdempotencyAttempt} from '../utils/idempotency';
import {commissionCents,advisorSplit,penaltyCents,fundsAfter,supplierRemainder,fundsDelta,integerMoney,assertTransition,refundableRemaining,assertRefundAmount,requiresApproval,overpaymentCents,writeOffRemaining} from '../lib/travel-money';
import {consumeManagerApproval} from '../utils/managerApproval';
import {validateDocumentUpload,documentStorageKey} from '../lib/documents';
import {isObjectStorageConfigured,assertObjectStorageConfigured,signObjectRequest,verifyUploadedObject,type ObjectMetadata} from '../../integrations/storage';
import {dayShift,shiftDate} from '../lib/trip-copy';
import {parseProfile,readProfile,applyLoyalty} from '../lib/client-profile';
import {parsePassportExpiry} from '../lib/passport-check';
import {commissionForecast,FORECAST_BOOKING} from '../lib/commission-forecast';
import {toCsv,centsDecimal} from '../lib/csv';
import {planningAmount,planningDate,componentTerms,syncPaymentSchedule} from '../lib/trip-planning';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const code=(prefix:string)=>`${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
export async function lockTransactionKey(tx:any,key:string){await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS acquired`;}
function authorize(context:any,permission:Permission){if(!permissions[permission]({session:context.session}))throw new Error('Not authorized');}
async function audit(tx:any,context:any,action:string,list:string,id:string,before:any,after:any){await tx.auditEvent.create({data:{actorId:context.session?.itemId||null,action,targetList:list,targetId:id,before:before?JSON.parse(JSON.stringify(before)):undefined,after:after?JSON.parse(JSON.stringify(after)):undefined,requestId:randomBytes(12).toString('hex')}});}
/** Operator rule violations are written for the advisor; tag them so the dashboard shows them (database/driver text is still filtered client-side). */
async function userFacing(run:()=>Promise<any>):Promise<any>{try{return await run();}catch(e:any){if(e instanceof GraphQLError)throw e;throw new GraphQLError(String(e?.message||'Request failed'),{extensions:{code:'KS_USER_INPUT_ERROR'}});}}
async function command(context:any,operation:string,input:any,permission:Permission,run:(tx:any)=>Promise<any>){
 authorize(context,permission);if(!input.idempotencyKey?.trim())throw new Error('Idempotency key required');
 return userFacing(()=>guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{
  await lockTransactionKey(tx,`travel-idempotency:${input.idempotencyKey}`);
  const {attempt,replay}=await getOrCreateIdempotencyAttempt(tx,{key:input.idempotencyKey,requestPath:operation,requestParams:{...input,actorId:context.session.itemId}});
  if(replay&&attempt.recoveryPoint==='completed')return attempt.responseBody;
  const result=await run(tx);const json=JSON.parse(JSON.stringify(result));
  await updateIdempotencyAttempt(tx,attempt.id,'completed',json,200);return json;
 },{timeout:20000}));
}
async function createProposalOptions(tx:any,proposalId:string,options:any[],currencyCode:string){
 for(const [sort,option] of options.entries()){
  if(!String(option.title||'').trim())throw new Error('Option title required');
  const o=await tx.proposalOption.create({data:{proposalId,title:option.title,sort}});
  for(const [index,item] of (option.items||[]).entries()){integerMoney(item.sellCents);commissionCents(item.sellCents,item.estimatedCommissionBps||0);await tx.proposalItem.create({data:{optionId:o.id,title:item.title,kind:item.kind,supplierId:item.supplierId||null,details:item.details||'',sellCents:item.sellCents,estimatedCommissionBps:item.estimatedCommissionBps||0,sort:index,currencyCode}});}
 }
}
/** Creates a sent invoice with its payment collection and lines. Caller holds the trip lock. */
const partyName=(v:any)=>{const n=String(v||'').replace(/\s+/g,' ').trim();if(!n||n.length>80)throw new Error('Party name required (80 characters maximum)');return n;};
async function partyTrip(tx:any,context:any,tripId:any){const t=await trip(tx,String(tripId||''));
 if(t.advisorId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor may manage parties and rooms');
 if(['completed','cancelled'].includes(t.status))throw new Error('Trip is closed');return t;}
/** Travelers must be on this trip, and a traveler pays through one party only. */
async function partyTravelerIds(tx:any,t:any,raw:any,exceptPartyId?:string){
 const ids:string[]=[...new Set<string>((Array.isArray(raw)?raw:[]).map(String))];if(!ids.length)return ids;
 const found=await tx.traveler.findMany({where:{id:{in:ids},trips:{some:{id:t.id}}},select:{id:true}});if(found.length!==ids.length)throw new Error('Traveler is not on this trip');
 const other=await tx.tripParty.findFirst({where:{tripId:t.id,...(exceptPartyId?{NOT:{id:exceptPartyId}}:{}),travelers:{some:{id:{in:ids}}}},select:{name:true}});if(other)throw new Error(`A traveler is already in the party "${other.name}"`);
 return ids;}
async function createInvoice(tx:any,context:any,t:any,lines:any[],dueAt?:any,fixedToken?:string,partyId?:string|null){
 if(!lines?.length)throw new Error('Invoice lines required');let total=0;
 for(const l of lines){integerMoney(l.amountCents);total+=l.amountCents;}integerMoney(total);const token=fixedToken||randomBytes(32).toString('base64url');
 const collection=await tx.paymentCollection.create({data:{amount:total,currencyCode:t.currencyCode}});
 const invoice=await tx.clientInvoice.create({data:{tripId:t.id,number:code('INV'),status:'sent',totalCents:total,collectedCents:0,dueAt:dueAt?new Date(dueAt):new Date(),publicToken:hash(token),currencyCode:t.currencyCode,paymentCollectionId:collection.id,...(partyId?{partyId}:{})}});
 for(const l of lines)await tx.clientInvoiceLine.create({data:{invoiceId:invoice.id,description:l.description,amountCents:l.amountCents,unitPriceCents:l.amountCents,quantity:1,feesCents:0,taxCents:0,kind:l.kind,currencyCode:t.currencyCode,snapshot:{description:l.description,amountCents:l.amountCents,quantity:1,feesCents:0,taxCents:0,kind:l.kind}}});
 await audit(tx,context,'invoice','ClientInvoice',invoice.id,null,invoice);return {invoice,token};
}
/** Deposit link is derived from the proposal token the client already holds, so a repeated acceptance can return the same link without storing a raw secret. */
const depositToken=(proposalToken:string)=>hash(`proposal-deposit:${proposalToken}`);
const depositBpsOf=(v:any)=>{const n=v===undefined||v===null||v===''?0:Number(v);if(!Number.isInteger(n)||n<0||n>10000)throw new Error('Deposit must be 0 to 100 percent');return n;};
const depositCentsFor=(items:any[],bps:number)=>Math.round(items.reduce((n:number,i:any)=>n+i.sellCents,0)*bps/10000);
/** A hold is a promise the supplier will release the space; the advisor gets a reminder the day before it lapses. */
const closeHoldTask=(tx:any,componentId:string)=>tx.task.updateMany({where:{taskKey:`hold:${componentId}`,status:'open'},data:{status:'cancelled'}});
const taskNote=(v:any)=>{const n=String(v||'').trim();if(n.length>500)throw new Error('Note must be 500 characters or fewer');return n;};
/** Locks the task's trip, then checks the actor is the assignee, or (when unassigned) the trip's advisor, or a role manager. */
async function taskForChange(tx:any,context:any,taskId:any){
 const found=await tx.task.findUnique({where:{id:String(taskId||'')}});if(!found)throw new Error('Task not found');
 const t=found.tripId?await trip(tx,found.tripId):null;const task=await tx.task.findUnique({where:{id:found.id}});
 const owner=task.assigneeId||t?.advisorId||null;
 if(owner&&owner!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor or a manager can change this task');
 return {task,trip:t};
}
async function itineraryTrip(tx:any,context:any,tripId:string){
 const t=await trip(tx,tripId);if(t.advisorId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor may edit the itinerary');
 if(['completed','cancelled'].includes(t.status))throw new Error('Trip is closed');return t;
}
async function trip(tx:any,id:string){await lockTransactionKey(tx,`travel-trip:${id}`);const row=await tx.trip.findUnique({where:{id}});if(!row)throw new Error('Trip not found');return row;}
export async function clientBalanceCents(tx:any,tripId:string){
 const t=await tx.trip.findUnique({where:{id:tripId},include:{components:true,invoices:{where:{status:{not:'void'}}}}});
 const collectible=t.components.filter((c:any)=>c.bookingStatus!=='cancelled'&&c.paymentModel==='agency_collects').reduce((n:number,c:any)=>n+c.sellCents,t.planningFeeCents);
 return collectible-t.invoices.reduce((n:number,i:any)=>n+i.collectedCents,0);
}
async function transition(tx:any,context:any,row:any,next:string){assertTransition(row.status,next);
 if(['paid_in_full','traveling','completed'].includes(next)&&await clientBalanceCents(tx,row.id)>0)throw new Error('Client balance must be zero before this status');const changed=await tx.trip.updateMany({where:{id:row.id,status:row.status},data:{status:next}});if(changed.count!==1)throw new Error('Trip changed concurrently');await audit(tx,context,'transition','Trip',row.id,{status:row.status},{status:next});}
async function postFunds(tx:any,context:any,input:any){
 await trip(tx,input.tripId);const entries=await tx.clientFundsEntry.findMany({where:{tripId:input.tripId}});const balance=entries.reduce((n:number,e:any)=>n+fundsDelta(e.entryType,e.amountCents),0);
 const amount=integerMoney(input.amountCents,input.entryType==='reversal');fundsAfter(balance,fundsDelta(input.entryType,amount));
 if(input.componentId){const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c||c.tripId!==input.tripId||c.paymentModel!=='agency_collects')throw new Error('Component is not collected by this trip');}
 if(input.entryType==='transfer_planning_fee'){
  const lines=await tx.clientInvoiceLine.aggregate({where:{invoice:{tripId:input.tripId,status:'paid'},kind:'planning_fee'},_sum:{amountCents:true}});
  const prior=entries.filter((e:any)=>e.entryType==='transfer_planning_fee').reduce((n:number,e:any)=>n+e.amountCents,0);
  if(amount+prior>(lines._sum.amountCents||0))throw new Error('Planning fee transfer exceeds paid planning invoices');
 }
 const row=await tx.clientFundsEntry.create({data:{tripId:input.tripId,componentId:input.componentId||null,entryType:input.entryType,amountCents:amount,currencyCode:input.currencyCode||'USD',reference:input.reference||'',reason:input.reason||'',occurredAt:new Date(),entryKey:input.entryKey||randomBytes(16).toString('hex')}});
 if(input.reverseOfId){const linked=await tx.clientFundsEntry.updateMany({where:{id:input.reverseOfId,reversedById:null},data:{reversedById:row.id}});if(linked.count!==1)throw new Error('Entry already reversed');}
 await audit(tx,context,'post','ClientFundsEntry',row.id,null,{entryType:row.entryType,amountCents:row.amountCents});return row;
}
/** Reserve locally (lock, cap, approval, Refund row), call the provider outside any transaction, then finalize under the trip lock. */
export async function refundClientPayment(context:any,input:any){
 authorize(context,'canIssueRefunds');
 const actorId=context.session.itemId;const key=String(input.idempotencyKey||'').trim();
 if(!key)throw new Error('Idempotency key required');const reason=String(input.reason||'').trim();if(!reason)throw new Error('Reason required');
 const amount=integerMoney(input.amountCents);
 const db=guardKeystonePrismaResults(context.prisma as any);const refundKey=`refund:${key}`;
 const reserved=await db.$transaction(async(tx:any)=>{
  const pay=await tx.payment.findUnique({where:{id:input.paymentId},include:{order:true}});if(!pay||!pay.order)throw new Error('Payment not found');
  await trip(tx,pay.order.tripId);
  const existing=await tx.refund.findUnique({where:{idempotencyKey:refundKey}});
  if(existing){if(existing.paymentId!==pay.id||existing.amount!==amount||existing.reason!==reason)throw new Error('Idempotency key was already used with a different refund');return {refund:existing,pay,replay:true};}
  if(!['succeeded','partially_refunded'].includes(pay.status))throw new Error('Payment is not refundable');
  if(!pay.providerPaymentId)throw new Error('Manual payments are refunded outside the system');
  const pending=await tx.refund.aggregate({where:{paymentId:pay.id,status:{in:['processing','unknown']}},_sum:{amount:true}});
  assertRefundAmount(amount,refundableRemaining(pay.amount,pay.refundedAmount,pending._sum.amount||0));
  const settings=await tx.agencySettings.findFirst();const threshold=settings?.refundApprovalThresholdCents??50000;
  if(requiresApproval(amount,threshold))await consumeManagerApproval(tx,{approvalId:input.approvalId,actorId,actionType:'refund_payment',targetId:pay.id,amountCents:amount,reason,entityType:'Payment',entityId:pay.id});
  const refund=await tx.refund.create({data:{idempotencyKey:refundKey,amount,currencyCode:pay.currencyCode,status:'processing',reason,paymentId:pay.id,orderId:pay.orderId,requestedById:actorId,approvedById:input.approvalId?(await tx.managerApproval.findUnique({where:{id:input.approvalId}}))?.approvedById||null:null}});
  await audit(tx,context,'refund_requested','Payment',pay.id,null,{refundId:refund.id,amountCents:amount,reason});
  return {refund,pay,replay:false};
 },{timeout:20000,isolationLevel:'Serializable'});
 const {refund,pay}=reserved;
 if(refund.status==='succeeded')return {refundId:refund.id,status:'succeeded',amountCents:refund.amount};
 if(refund.status==='failed')return {refundId:refund.id,status:'failed',amountCents:refund.amount};
 const {refundPayment}=await import('../utils/paymentProviderAdapter');
 let result:any=null,final='unknown';
 try{result=await refundPayment({provider:stripeProvider,paymentId:pay.providerPaymentId,amount:refund.amount,currency:pay.currencyCode,idempotencyKey:refundKey});final=result.status==='succeeded'?'succeeded':['failed','canceled'].includes(result.status)?'failed':'unknown';}catch{final='unknown';}
 return db.$transaction(async(tx:any)=>{
  await trip(tx,pay.order.tripId);
  const moved=await tx.refund.updateMany({where:{id:refund.id,status:{in:['processing','unknown']}},data:{status:final,providerRefundId:result?.refundId||null,providerData:result?.data?JSON.parse(JSON.stringify({id:result.refundId,status:result.status,amount:result.amount})):undefined,processedAt:final==='succeeded'?new Date():null}});
  if(moved.count!==1||final!=='succeeded')return {refundId:refund.id,status:final,amountCents:refund.amount};
  const p=await tx.payment.update({where:{id:pay.id},data:{refundedAmount:{increment:refund.amount}}});
  await tx.payment.update({where:{id:pay.id},data:{status:p.refundedAmount>=p.amount?'refunded':'partially_refunded'}});
  const entry=await postFunds(tx,context,{tripId:pay.order.tripId,componentId:input.componentId||null,entryType:'refund_to_client',amountCents:refund.amount,currencyCode:pay.currencyCode,reference:refund.id,reason,entryKey:`refund:${refund.id}`});
  await audit(tx,context,'refund','Payment',pay.id,{refundedAmount:pay.refundedAmount},{refundedAmount:p.refundedAmount,refundId:refund.id,fundsEntryId:entry.id,reason});
  return {refundId:refund.id,status:'succeeded',amountCents:refund.amount};
 },{timeout:20000});
}
const objectOf=(d:any):ObjectMetadata=>({key:d.storageKey,contentType:d.mimeType,byteSize:d.byteSize,checksumSha256:d.checksumSha256});
/** Documents are private: only the assigned advisor or a role manager may add or read them. */
async function documentTrip(db:any,context:any,tripId:string){
 const t=await db.trip.findUnique({where:{id:tripId}});if(!t)throw new Error('Trip not found');
 if(t.advisorId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor may manage this trip\'s documents');return t;
}
async function loadDocument(context:any,permission:Permission,documentId:string){
 authorize(context,permission);const d=await context.prisma.document.findUnique({where:{id:String(documentId||'')}});if(!d||!d.tripId)throw new Error('Document not found');
 await documentTrip(context.prisma,context,d.tripId);return d;
}
export const operators:Record<string,(context:any,input:any)=>Promise<any>>={
 requestDocumentUpload:async(context,input)=>{
  authorize(context,'canManageDocuments');if(!isObjectStorageConfigured())throw new Error('Document storage is not configured. Uploads and downloads are unavailable until an administrator sets the S3 object storage settings.');assertObjectStorageConfigured();
  const v=validateDocumentUpload(input);const {title,mimeType}=v;
  const doc=await command(context,'requestDocumentUpload',input,'canManageDocuments',async tx=>{
   const t=await trip(tx,input.tripId);await documentTrip(tx,context,t.id);
   if(input.travelerId&&!(await tx.traveler.findFirst({where:{id:String(input.travelerId),trips:{some:{id:t.id}}}})))throw new Error('Traveler is not on this trip');
   const d=await tx.document.create({data:{title,kind:v.kind,tripId:t.id,travelerId:input.travelerId||null,mimeType,byteSize:v.byteSize,checksumSha256:v.checksumSha256,storageKey:documentStorageKey(t.id,mimeType)}});
   await audit(tx,context,'request_upload','Document',d.id,null,{title,kind:v.kind,mimeType,byteSize:v.byteSize,checksumSha256:v.checksumSha256});return {id:d.id,storageKey:d.storageKey};
  });
  const signed=signObjectRequest('PUT',objectOf({...doc,mimeType,byteSize:v.byteSize,checksumSha256:v.checksumSha256}));
  return {documentId:doc.id,uploadUrl:signed.url,expiresAt:signed.expiresAt,headers:Object.entries(signed.headers).map(([name,value])=>({name,value}))};
 },
 completeDocumentUpload:async(context,input)=>{
  const doc=await loadDocument(context,'canManageDocuments',input.documentId);if(doc.verifiedAt)return {id:doc.id,verified:true,alreadyVerified:true};
  assertObjectStorageConfigured();await verifyUploadedObject(objectOf(doc));
  return command(context,'completeDocumentUpload',input,'canManageDocuments',async tx=>{
   await trip(tx,doc.tripId);const done=await tx.document.updateMany({where:{id:doc.id,verifiedAt:null},data:{verifiedAt:new Date()}});
   if(done.count===1)await audit(tx,context,'verify_upload','Document',doc.id,{verifiedAt:null},{verified:true,checksumSha256:doc.checksumSha256});return {id:doc.id,verified:true};
  });
 },
 documentDownloadUrl:async(context,input)=>{
  const doc=await loadDocument(context,'canManageDocuments',input.documentId);if(!doc.verifiedAt)throw new Error('This document has not finished uploading');assertObjectStorageConfigured();
  const signed=signObjectRequest('GET',objectOf(doc),120);await context.prisma.auditEvent.create({data:{actorId:context.session.itemId,action:'download',targetList:'Document',targetId:doc.id,requestId:randomBytes(12).toString('hex')}});
  return {url:signed.url,expiresAt:signed.expiresAt};
 },
 saveTripTraveler:(context,input)=>command(context,'saveTripTraveler',input,'canManageClients',async tx=>{
 authorize(context,'canManageTrips');const t=await trip(tx,input.tripId);
 if(t.advisorId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor may edit travelers');
 if(['completed','cancelled'].includes(t.status))throw new Error('Trip is closed');if(!t.clientId)throw new Error('Trip needs a client');
 const firstName=String(input.firstName||'').trim(),lastName=String(input.lastName||'').trim();if(!firstName||!lastName||firstName.length>100||lastName.length>100)throw new Error('First and last name required (100 characters maximum)');
 const nationality=String(input.nationality||'').trim();if(nationality.length>80)throw new Error('Nationality is too long');
 let old:any=null;if(input.travelerId){old=await tx.traveler.findUnique({where:{id:input.travelerId},include:{trips:{select:{id:true}}}});if(!old||old.clientId!==t.clientId||!old.trips.some((x:any)=>x.id===t.id))throw new Error('Traveler not found in this trip');}
 const data:any={firstName,lastName,nationality};
 // The expiry date is sensitive: stored, never returned, never written to the audit log (only the fact it was recorded).
 const expiry=input.passportExpiresAt?parsePassportExpiry(input.passportExpiresAt):null;if(expiry){data.passportExpiresAt=expiry;data.passportOnFile=true;}
 const row=old?await tx.traveler.update({where:{id:old.id},data}):await tx.traveler.create({data:{...data,clientId:t.clientId,trips:{connect:{id:t.id}}}});
 await audit(tx,context,'edit_traveler','Traveler',row.id,old?{firstName:old.firstName,lastName:old.lastName,nationality:old.nationality}:null,{firstName,lastName,nationality,...(expiry?{passportExpiryRecorded:true}:{})});return {id:row.id};
 }),
 addItineraryDay:(context,input)=>command(context,'addItineraryDay',input,'canManageTrips',async tx=>{
 const t=await itineraryTrip(tx,context,input.tripId);const title=String(input.title||'').trim();if(!title||title.length>120)throw new Error('Day title required (120 characters maximum)');
 if(!/^\d{4}-\d{2}-\d{2}/.test(String(input.date||'')))throw new Error('Valid day date required');const date=new Date(`${String(input.date).slice(0,10)}T12:00:00.000Z`);if(Number.isNaN(date.getTime()))throw new Error('Valid day date required');
 const row=await tx.itineraryDay.create({data:{tripId:t.id,title,date}});await audit(tx,context,'add_day','ItineraryDay',row.id,null,{title,date});return {id:row.id};
 }),
 addItineraryItem:(context,input)=>command(context,'addItineraryItem',input,'canManageTrips',async tx=>{
 const t=await itineraryTrip(tx,context,input.tripId);const dayRow=await tx.itineraryDay.findUnique({where:{id:input.dayId},include:{items:{select:{sort:true}}}});if(!dayRow||dayRow.tripId!==t.id)throw new Error('Itinerary day not found in this trip');
 const title=String(input.title||'').trim();if(!title||title.length>160)throw new Error('Item title required (160 characters maximum)');
 const time=String(input.time||'').trim(),location=String(input.location||'').trim(),notes=String(input.notes||'').trim();if(time.length>40||location.length>160||notes.length>2000)throw new Error('Item time, location or notes too long');
 const sort=dayRow.items.reduce((n:number,i:any)=>Math.max(n,i.sort||0),-1)+1;
 const row=await tx.itineraryItem.create({data:{dayId:dayRow.id,title,time,location,notes,sort}});await audit(tx,context,'add_item','ItineraryItem',row.id,null,{title,time,location,dayId:dayRow.id});return {id:row.id};
 }),
 updateTripPlanning:(context,input)=>command(context,'updateTripPlanning',input,'canManageTrips',async tx=>{
 const t=await trip(tx,input.tripId);if(['completed','cancelled'].includes(t.status))throw new Error('Trip is closed');
 const amount=planningAmount(input.planningFeeCents);
 if(amount!==t.planningFeeCents){
  if(await tx.clientInvoiceLine.count({where:{kind:'planning_fee',invoice:{tripId:t.id,status:{not:'void'}}}}))throw new Error('Planning fee is already invoiced');
  if(await tx.paymentSchedule.count({where:{tripId:t.id,kind:'planning_fee',status:{in:['invoiced','paid']}}}))throw new Error('Planning fee schedule is already committed');
 }
 const row=await tx.trip.update({where:{id:t.id},data:{planningFeeCents:amount}});await syncPaymentSchedule(tx,row);
 await audit(tx,context,'edit_planning_fee','Trip',t.id,{planningFeeCents:t.planningFeeCents},{planningFeeCents:amount});return {id:t.id};
 }),
 updateComponentTerms:(context,input)=>command(context,'updateComponentTerms',input,'canManageTrips',async tx=>{
 const t=await trip(tx,input.tripId);if(['completed','cancelled'].includes(t.status))throw new Error('Trip is closed');
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c||c.tripId!==t.id)throw new Error('Component not found in this trip');if(c.bookingStatus==='cancelled')throw new Error('Component is cancelled');
 if(await tx.paymentSchedule.count({where:{componentId:c.id,status:{in:['invoiced','paid']}}}))throw new Error('Component schedule is already committed');
 const terms=componentTerms(input,c.sellCents);await tx.tripComponent.update({where:{id:c.id},data:terms});await syncPaymentSchedule(tx,t);
 await audit(tx,context,'edit_payment_terms','TripComponent',c.id,{depositCents:c.depositCents,depositDueAt:c.depositDueAt,finalDueAt:c.finalDueAt},terms);return {id:c.id};
 }),
 createTripFromInquiry:(context,input)=>command(context,'createTripFromInquiry',input,'canManageTrips',async tx=>{
 const inquiry=await tx.inquiry.findUnique({where:{id:input.inquiryId}});if(!inquiry)throw new Error('Inquiry not found');await lockTransactionKey(tx,`inquiry:${inquiry.id}`);
 let clientId=inquiry.clientId;if(!clientId)clientId=(await tx.client.create({data:{name:inquiry.name,email:inquiry.email,phone:inquiry.phone}})).id;
 const row=await tx.trip.create({data:{tripNumber:code('TR'),title:input.title||inquiry.destinations,clientId,inquiryId:inquiry.id,advisorId:inquiry.assignedAdvisorId||context.session.itemId,startDate:inquiry.travelWindowStart,endDate:inquiry.travelWindowEnd,status:'planning',currencyCode:'USD'}});
 await tx.inquiry.update({where:{id:inquiry.id},data:{clientId,status:'proposal'}});await audit(tx,context,'create','Trip',row.id,null,row);return row;
 }),
 buildProposal:(context,input)=>command(context,'buildProposal',input,'canManageTrips',async tx=>{
 await trip(tx,input.tripId);const prior=await tx.proposal.aggregate({where:{tripId:input.tripId},_max:{version:true}});
 if(!Array.isArray(input.options)||!input.options.length)throw new Error('Proposal options required');
 const p=await tx.proposal.create({data:{tripId:input.tripId,version:(prior._max.version||0)+1,status:'draft',introNote:input.introNote||'',depositBps:depositBpsOf(input.depositBps)}});
 await createProposalOptions(tx,p.id,input.options,input.currencyCode||'USD');
 await audit(tx,context,'build','Proposal',p.id,null,p);return p;
 }),
 completeTask:(context,input)=>command(context,'completeTask',input,'canManageTasks',async tx=>{
  const {task}=await taskForChange(tx,context,input.taskId);const note=taskNote(input.note);
  if(task.status==='completed')return {id:task.id,status:'completed',alreadyCompleted:true};
  if(task.status!=='open')throw new Error('Only open tasks can be completed');
  const done=await tx.task.updateMany({where:{id:task.id,status:'open'},data:{status:'completed',completedAt:new Date(),completedById:context.session.itemId,completionNote:note}});if(done.count!==1)throw new Error('Task changed; reload and try again');
  await audit(tx,context,'complete','Task',task.id,{status:'open'},{status:'completed',title:task.title,type:task.type,note});return {id:task.id,status:'completed'};
 }),
 reopenTask:(context,input)=>command(context,'reopenTask',input,'canManageTasks',async tx=>{
  const {task}=await taskForChange(tx,context,input.taskId);const note=taskNote(input.note);
  if(task.status==='open')return {id:task.id,status:'open',alreadyOpen:true};
  if(task.status!=='completed')throw new Error('Only completed tasks can be reopened');
  if(!note)throw new Error('Say why the task is being reopened');
  const done=await tx.task.updateMany({where:{id:task.id,status:'completed'},data:{status:'open',completedAt:null,completedById:null,completionNote:''}});if(done.count!==1)throw new Error('Task changed; reload and try again');
  await audit(tx,context,'reopen','Task',task.id,{status:'completed',completedAt:task.completedAt,completedById:task.completedById,note:task.completionNote},{status:'open',reason:note});return {id:task.id,status:'open'};
 }),
 updateProposalDraft:(context,input)=>command(context,'updateProposalDraft',input,'canManageTrips',async tx=>{
 const found=await tx.proposal.findUnique({where:{id:input.proposalId}});if(!found)throw new Error('Proposal not found');await trip(tx,found.tripId);
 const p=await tx.proposal.findUnique({where:{id:input.proposalId},include:{options:{include:{items:true}}}});if(p.status!=='draft')throw new Error('Only draft proposals can be edited');
 if(!Array.isArray(input.options)||!input.options.length)throw new Error('Proposal options required');
 const before={introNote:p.introNote,depositBps:p.depositBps,options:p.options.map((o:any)=>({title:o.title,items:o.items.map((i:any)=>({title:i.title,kind:i.kind,sellCents:i.sellCents,estimatedCommissionBps:i.estimatedCommissionBps}))}))};
 await tx.proposalItem.deleteMany({where:{optionId:{in:p.options.map((o:any)=>o.id)}}});await tx.proposalOption.deleteMany({where:{proposalId:p.id}});
 await createProposalOptions(tx,p.id,input.options,input.currencyCode||'USD');await tx.proposal.update({where:{id:p.id},data:{introNote:String(input.introNote||'').trim(),depositBps:depositBpsOf(input.depositBps)}});
 await audit(tx,context,'edit_draft','Proposal',p.id,before,{introNote:input.introNote||'',depositBps:depositBpsOf(input.depositBps),options:input.options});return {id:p.id,version:p.version};
 }),
 sendProposal:(context,input)=>command(context,'sendProposal',input,'canManageTrips',async tx=>{
 const p=await tx.proposal.findUnique({where:{id:input.proposalId}});if(!p||p.status!=='draft')throw new Error('Only draft proposals may be sent');const t=await trip(tx,p.tripId);
 const token=randomBytes(32).toString('base64url');await tx.proposal.updateMany({where:{tripId:p.tripId,status:{in:['sent','viewed']}},data:{status:'superseded'}});
 await tx.proposal.update({where:{id:p.id},data:{status:'sent',sentAt:new Date(),publicToken:hash(token)}});if(t.status==='planning')await transition(tx,context,t,'proposal_sent');
 await audit(tx,context,'send','Proposal',p.id,{status:p.status},{status:'sent'});return {id:p.id,token};
 }),
 recordInsuranceOffer:(context,input)=>command(context,'recordInsuranceOffer',input,'canManageTrips',async tx=>{
 const t=await partyTrip(tx,context,input.tripId);const decision=parseDecision(input.decision);
 const waiverNote=decision==='declined'?parseWaiverNote(input.waiverNote):'';
 const tr=await tx.traveler.findFirst({where:{id:String(input.travelerId||''),trips:{some:{id:t.id}}},select:{id:true}});if(!tr)throw new Error('Traveler is not on this trip');
 const last=await tx.insuranceOffer.findFirst({where:{tripId:t.id,travelerId:tr.id},orderBy:[{recordedAt:'desc'},{createdAt:'desc'}],select:{decision:true,waiverNote:true}});
 if(last&&last.decision===decision&&(last.waiverNote||'')===waiverNote)throw new Error('That answer is already on record');
 const row=await tx.insuranceOffer.create({data:{tripId:t.id,travelerId:tr.id,decision,waiverNote,recordedAt:new Date(),recordedById:context.session.itemId}});
 await audit(tx,context,'insurance_'+decision,'InsuranceOffer',row.id,last?{decision:last.decision}:null,{decision,travelerId:tr.id,waiverRecorded:decision==='declined'});return {id:row.id,decision,recordedAt:row.recordedAt};
 }),
 addTripParty:(context,input)=>command(context,'addTripParty',input,'canManageTrips',async tx=>{
 const t=await partyTrip(tx,context,input.tripId);const name=partyName(input.name);
 if(await tx.tripParty.count({where:{tripId:t.id}})>=40)throw new Error('At most 40 parties per trip');
 if(await tx.tripParty.findFirst({where:{tripId:t.id,name:{equals:name,mode:'insensitive'}}}))throw new Error('A party with this name already exists');
 const ids=await partyTravelerIds(tx,t,input.travelerIds);const secret=randomBytes(32).toString('base64url');
 const row=await tx.tripParty.create({data:{name,tripId:t.id,portalToken:hash(secret),...(ids.length?{travelers:{connect:ids.map((id:string)=>({id}))}}:{})}});
 await audit(tx,context,'add_party','TripParty',row.id,null,{name,travelers:ids.length});return {id:row.id,token:secret};
 }),
 editTripParty:(context,input)=>command(context,'editTripParty',input,'canManageTrips',async tx=>{
 const row=await tx.tripParty.findUnique({where:{id:String(input.partyId||'')},include:{travelers:{select:{id:true}}}});if(!row||!row.tripId)throw new Error('Party not found');const t=await partyTrip(tx,context,row.tripId);
 const name=input.name===undefined?row.name:partyName(input.name);
 if(name.toLowerCase()!==row.name.toLowerCase()&&await tx.tripParty.findFirst({where:{tripId:t.id,name:{equals:name,mode:'insensitive'},NOT:{id:row.id}}}))throw new Error('A party with this name already exists');
 let travelers:any=undefined;if(input.travelerIds!==undefined){const ids=await partyTravelerIds(tx,t,input.travelerIds,row.id);travelers={set:ids.map((id:string)=>({id}))};
  const gone=row.travelers.map((x:any)=>x.id).filter((id:string)=>!ids.includes(id));if(gone.length&&await tx.tripRoom.count({where:{partyId:row.id,guests:{some:{id:{in:gone}}}}}))throw new Error('Remove those travelers from this party\'s rooms first');}
 await tx.tripParty.update({where:{id:row.id},data:{name,...(travelers?{travelers}:{})}});
 await audit(tx,context,'edit_party','TripParty',row.id,{name:row.name,travelers:row.travelers.length},{name,travelers:travelers?input.travelerIds.length:row.travelers.length});return {id:row.id};
 }),
 shareTripParty:(context,input)=>command(context,'shareTripParty',input,'canManageTrips',async tx=>{
 const row=await tx.tripParty.findUnique({where:{id:String(input.partyId||'')}});if(!row||!row.tripId)throw new Error('Party not found');await partyTrip(tx,context,row.tripId);
 const secret=randomBytes(32).toString('base64url');await tx.tripParty.update({where:{id:row.id},data:{portalToken:hash(secret)}});
 await audit(tx,context,'share_party','TripParty',row.id,null,{name:row.name,rotated:true});return {id:row.id,token:secret};
 }),
 saveTripRoom:(context,input)=>command(context,'saveTripRoom',input,'canManageTrips',async tx=>{
 const t=await partyTrip(tx,context,input.tripId);const label=String(input.label||'').trim(),roomType=String(input.roomType||'').trim();
 if(!label||label.length>60)throw new Error('Room label required (60 characters maximum)');if(roomType.length>60)throw new Error('Room type is too long');
 let party:any=null;if(input.partyId){party=await tx.tripParty.findUnique({where:{id:String(input.partyId)},include:{travelers:{select:{id:true}}}});if(!party||party.tripId!==t.id)throw new Error('Party not found in this trip');}
 const guestIds:string[]=[...new Set<string>((Array.isArray(input.guestIds)?input.guestIds:[]).map(String))];if(guestIds.length>12)throw new Error('At most 12 guests per room');
 const known=await tx.traveler.findMany({where:{id:{in:guestIds},trips:{some:{id:t.id}}},select:{id:true}});if(known.length!==guestIds.length)throw new Error('Guest is not a traveler on this trip');
 if(party&&guestIds.some(g=>!party.travelers.some((x:any)=>x.id===g)))throw new Error('Guest is not in this party');
 const clash=await tx.tripRoom.findFirst({where:{tripId:t.id,...(input.roomId?{NOT:{id:String(input.roomId)}}:{}),guests:{some:{id:{in:guestIds}}}},select:{label:true}});if(clash)throw new Error(`A guest is already in ${clash.label}`);
 let row:any;if(input.roomId){const old=await tx.tripRoom.findUnique({where:{id:String(input.roomId)}});if(!old||old.tripId!==t.id)throw new Error('Room not found in this trip');row=await tx.tripRoom.update({where:{id:old.id},data:{label,roomType,partyId:party?party.id:null,guests:{set:guestIds.map(id=>({id}))}}});}
 else{if(await tx.tripRoom.count({where:{tripId:t.id}})>=100)throw new Error('At most 100 rooms per trip');row=await tx.tripRoom.create({data:{label,roomType,tripId:t.id,partyId:party?party.id:null,guests:{connect:guestIds.map(id=>({id}))}}});}
 await audit(tx,context,input.roomId?'edit_room':'add_room','TripRoom',row.id,null,{label,roomType,guests:guestIds.length});return {id:row.id};
 }),
 removeTripRoom:(context,input)=>command(context,'removeTripRoom',input,'canManageTrips',async tx=>{
 const row=await tx.tripRoom.findUnique({where:{id:String(input.roomId||'')}});if(!row||!row.tripId)throw new Error('Room not found');await partyTrip(tx,context,row.tripId);
 await tx.tripRoom.delete({where:{id:row.id}});await audit(tx,context,'remove_room','TripRoom',row.id,{label:row.label},null);return {id:row.id};
 }),
 saveClientProfile:(context,input)=>command(context,'saveClientProfile',input,'canManageClients',async tx=>{
 const c=await tx.client.findUnique({where:{id:String(input.clientId||'')}});if(!c)throw new Error('Client not found');
 const next=parseProfile(input);const before=readProfile(c.travelProfile);
 const changed=(['seat','room','dietary','notes'] as const).filter(k=>before[k]!==next[k]);if(JSON.stringify(before.celebrations)!==JSON.stringify(next.celebrations))changed.push('celebrations' as any);
 await tx.client.update({where:{id:c.id},data:{travelProfile:next as any}});
 await audit(tx,context,'edit_client_profile','Client',c.id,null,{changed});return {id:c.id,changed};
 }),
 saveClientLoyalty:(context,input)=>command(context,'saveClientLoyalty',input,'canManageClients',async tx=>{
 const c=await tx.client.findUnique({where:{id:String(input.clientId||'')}});if(!c)throw new Error('Client not found');
 const r=applyLoyalty(c.loyaltyNumbers,input.program,input.number);
 if(Object.keys(r.map).length>20)throw new Error('At most 20 loyalty programs per client');
 await tx.client.update({where:{id:c.id},data:{loyaltyNumbers:r.map as any}});
 // Program name and action only; the number is never audited or returned.
 await audit(tx,context,'edit_client_loyalty','Client',c.id,null,{program:r.program,action:r.action});return {id:c.id,program:r.program,action:r.action};
 }),
 duplicateTrip:(context,input)=>command(context,'duplicateTrip',input,'canManageTrips',async tx=>{
  const src=await trip(tx,String(input.tripId||''));
  if(src.advisorId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assigned advisor may copy this trip');
  const title=String(input.title||'').trim();if(!title||title.length>160)throw new Error('Title required (160 characters maximum)');
  const parsed=input.startDate?planningDate(input.startDate):null;if(input.startDate&&!parsed)throw new Error('Valid start date required');const start=parsed?new Date(`${parsed.toISOString().slice(0,10)}T12:00:00.000Z`):null;
  const full=await tx.trip.findUnique({where:{id:src.id},include:{destinations:{select:{id:true}},components:{where:{bookingStatus:{not:'cancelled'}}},days:{include:{items:true},orderBy:{date:'asc'}}}});
  const firstDay=full.days.find((d:any)=>d.date)?.date||null;const shift=dayShift(full.startDate||firstDay,start);
  const clientId=input.clientId?String(input.clientId):full.clientId;if(input.clientId&&!(await tx.client.findUnique({where:{id:clientId}})))throw new Error('Client not found');
  const copy=await tx.trip.create({data:{tripNumber:code('TR'),title,clientId,advisorId:context.session.itemId,status:'planning',currencyCode:full.currencyCode,planningFeeCents:full.planningFeeCents,startDate:start||full.startDate,endDate:shiftDate(full.endDate,shift),destinations:{connect:full.destinations.map((d:any)=>({id:d.id}))}}});
  const componentIds=new Map<string,string>();
  for(const c of full.components){const n=await tx.tripComponent.create({data:{tripId:copy.id,supplierId:c.supplierId,title:c.title,kind:c.kind,sellCents:c.sellCents,netCostCents:c.netCostCents,commissionBps:c.commissionBps,commissionCents:c.commissionCents,commissionStatus:'expected',paymentModel:c.paymentModel,cancellationPolicy:c.cancellationPolicy,cancelPenaltySchedule:c.cancelPenaltySchedule??undefined,currencyCode:c.currencyCode,depositCents:c.depositCents,depositDueAt:shiftDate(c.depositDueAt,shift),finalDueAt:shiftDate(c.finalDueAt,shift),supplierDueAt:shiftDate(c.supplierDueAt,shift),startAt:shiftDate(c.startAt,shift),endAt:shiftDate(c.endAt,shift),bookingStatus:'quoted'}});componentIds.set(c.id,n.id);}
  let items=0;
  for(const d of full.days){const nd=await tx.itineraryDay.create({data:{tripId:copy.id,title:d.title,date:shiftDate(d.date,shift)}});for(const i of d.items){await tx.itineraryItem.create({data:{dayId:nd.id,title:i.title,time:i.time,location:i.location,notes:i.notes,sort:i.sort,componentId:i.componentId?componentIds.get(i.componentId)||null:null}});items++;}}
  const manual=await tx.task.findMany({where:{tripId:src.id,type:'follow_up',status:{not:'cancelled'},NOT:[{taskKey:{startsWith:'hold:'}},{taskKey:{startsWith:'short-paid:'}},{taskKey:{startsWith:'reminder:'}}]}});
  for(const k of manual)await tx.task.create({data:{taskKey:`copy:${copy.id}:${k.id}`,tripId:copy.id,assigneeId:context.session.itemId,title:k.title,type:'follow_up',status:'open',dueAt:shiftDate(k.dueAt,shift)}});
  await audit(tx,context,'duplicate','Trip',copy.id,null,{sourceTripId:src.id,sourceNumber:src.tripNumber,components:componentIds.size,days:full.days.length,items,tasks:manual.length,shiftDays:shift});
  return {id:copy.id,tripNumber:copy.tripNumber,components:componentIds.size,days:full.days.length,items,tasks:manual.length,shiftDays:shift};
 }),
 exportCommissionForecast:(context,input)=>command(context,'exportCommissionForecast',input,'canReadPayments',async tx=>{
 const comps=await tx.tripComponent.findMany({where:{bookingStatus:{in:FORECAST_BOOKING},commissionCents:{gt:0}},take:5000,orderBy:{endAt:'asc'},select:{id:true,title:true,bookingStatus:true,commissionStatus:true,commissionCents:true,currencyCode:true,startAt:true,endAt:true,supplier:{select:{id:true,name:true,commissionPaymentTermsDays:true}},trip:{select:{title:true}},allocations:{select:{amountCents:true}}}});
 const f=commissionForecast(comps);const stamp=new Date().toISOString().slice(0,10);
 const csv=toCsv(['Section','Name','Currency','Components','Expected','Received','Outstanding','Overdue'],[...f.bySupplier.map(r=>['Supplier',r.label,r.currencyCode,r.count,centsDecimal(r.expectedCents),centsDecimal(r.receivedCents),centsDecimal(r.outstandingCents),centsDecimal(r.overdueCents)]),...f.byMonth.map(r=>['Month due',r.label,r.currencyCode,r.count,centsDecimal(r.expectedCents),centsDecimal(r.receivedCents),centsDecimal(r.outstandingCents),centsDecimal(r.overdueCents)])])+'\r\n'+toCsv(['Overdue component','Trip','Supplier','Currency','Outstanding','Due date','Days late'],f.overdue.map(r=>[r.title,r.trip,r.supplier,r.currencyCode,centsDecimal(r.outstandingCents),r.dueAt.slice(0,10),r.daysLate]));
 await audit(tx,context,'export_commission_forecast','TripComponent','forecast',null,{components:comps.length,suppliers:f.bySupplier.length,months:f.byMonth.length,overdue:f.overdue.length,bytes:csv.length});
 return {filename:`commission-forecast-${stamp}.csv`,csv};
 }),
 setSupplierDue:(context,input)=>command(context,'setSupplierDue',input,'canManagePayments',async tx=>{
 const c0=await tx.tripComponent.findUnique({where:{id:String(input.componentId||'')}});if(!c0)throw new Error('Component not found');await trip(tx,c0.tripId);
 const c=await tx.tripComponent.findUnique({where:{id:c0.id}});if(c.bookingStatus==='cancelled')throw new Error('Component is cancelled');
 if(c.paymentModel!=='agency_collects')throw new Error('Only agency-collected components are paid to the supplier by the agency');
 const due=input.supplierDueAt===null||input.supplierDueAt===''||input.supplierDueAt===undefined?null:planningDate(input.supplierDueAt);
 const stored=due?new Date(`${due.toISOString().slice(0,10)}T12:00:00.000Z`):null;
 await tx.tripComponent.update({where:{id:c.id},data:{supplierDueAt:stored}});
 await audit(tx,context,'set_supplier_due','TripComponent',c.id,{supplierDueAt:c.supplierDueAt},{supplierDueAt:stored?stored.toISOString():null});return {id:c.id,supplierDueAt:stored?stored.toISOString():null};
 }),
 holdComponent:(context,input)=>command(context,'holdComponent',input,'canManageTrips',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:String(input.componentId||'')}});if(!c)throw new Error('Component not found');const t=await trip(tx,c.tripId);
 if(!['quoted','held'].includes(c.bookingStatus))throw new Error('Only quoted or held components can be held');
 if(!input.holdUntil)throw new Error('Hold expiry date required');const until=planningDate(input.holdUntil);if(!until)throw new Error('Hold expiry date required');if(until.getTime()<Date.now()-86400000)throw new Error('Hold expiry must not be in the past');
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'held',holdUntil:until}});
 const dueAt=new Date(until.getTime()-86400000);
 await tx.task.upsert({where:{taskKey:`hold:${c.id}`},update:{dueAt,status:'open',completedAt:null,completionNote:''},create:{taskKey:`hold:${c.id}`,tripId:t.id,assigneeId:t.advisorId,title:`Hold expires: ${c.title}`,type:'follow_up',dueAt,status:'open'}});
 await audit(tx,context,'hold','TripComponent',c.id,{bookingStatus:c.bookingStatus,holdUntil:c.holdUntil},{bookingStatus:'held',holdUntil:until.toISOString()});return {id:row.id,holdUntil:until.toISOString()};
 }),
 bookComponent:(context,input)=>command(context,'bookComponent',input,'canManageTrips',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c)throw new Error('Component not found');const t=await trip(tx,c.tripId);if(!['quoted','held'].includes(c.bookingStatus))throw new Error('Component cannot be booked');
 const confirmation=String(input.confirmationNumber||'').trim();if(!confirmation)throw new Error('Supplier confirmation number required');if(confirmation.length>80)throw new Error('Confirmation number must be 80 characters or fewer');
 integerMoney(input.netCostCents);const commission=commissionCents(c.sellCents,input.commissionBps??c.commissionBps);
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'booked',confirmationNumber:confirmation,confirmedAt:new Date(),confirmedById:context.session.itemId,holdUntil:null,netCostCents:input.netCostCents,paymentModel:input.paymentModel||c.paymentModel,commissionBps:input.commissionBps??c.commissionBps,commissionCents:commission,purchaseSnapshot:{title:c.title,sellCents:c.sellCents,netCostCents:input.netCostCents,quantity:1,feesCents:0,taxCents:0,currencyCode:c.currencyCode,commissionCents:commission}}});
 await closeHoldTask(tx,c.id);
 if(t.status==='accepted')await transition(tx,context,t,'booked');await audit(tx,context,'book','TripComponent',row.id,c,row);return row;
 }),
 generatePaymentSchedule:(context,input)=>command(context,'generatePaymentSchedule',input,'canManagePayments',async tx=>{
 const t=await trip(tx,input.tripId);const result=await syncPaymentSchedule(tx,t);await audit(tx,context,'schedule','Trip',t.id,null,result);return result;
 }),
 issueClientInvoice:(context,input)=>command(context,'issueClientInvoice',input,'canManagePayments',async tx=>{
 const t=await trip(tx,input.tripId);let partyId:string|null=null;
 if(input.partyId){const party=await tx.tripParty.findUnique({where:{id:String(input.partyId)}});if(!party||party.tripId!==t.id)throw new Error('Party not found in this trip');partyId=party.id;}
 const {invoice,token}=await createInvoice(tx,context,t,input.lines,input.dueAt,undefined,partyId);return {id:invoice.id,number:invoice.number,token,partyId};
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
 for(const a of [...input.allocations].sort((a:any,b:any)=>a.componentId.localeCompare(b.componentId))){integerMoney(a.amountCents);const c=await tx.tripComponent.findUnique({where:{id:a.componentId}});if(!c||c.supplierId!==input.supplierId||c.currencyCode!==(input.currencyCode||'USD'))throw new Error('Allocation supplier/currency mismatch');const t=await trip(tx,c.tripId);const prior=await tx.commissionAllocation.aggregate({where:{componentId:c.id},_sum:{amountCents:true}});const collected=(prior._sum.amountCents||0)+a.amountCents;const over=overpaymentCents(c.commissionCents,prior._sum.amountCents||0,a.amountCents);if(over>0)await consumeManagerApproval(tx,{approvalId:a.approvalId,actorId:context.session.itemId,actionType:'commission_overpayment',targetId:c.id,amountCents:over,reason:String(a.reason||''),entityType:'TripComponent',entityId:c.id});
 await tx.commissionAllocation.create({data:{receiptId:receipt.id,componentId:c.id,amountCents:a.amountCents,overpaymentCents:over,approvalId:over>0?a.approvalId:null,currencyCode:c.currencyCode}});await tx.tripComponent.update({where:{id:c.id},data:{commissionStatus:collected>=c.commissionCents?'received':'short_paid'}});
 const split=advisorSplit(a.amountCents,settings?.hostAgencySplitBps||0);await tx.advisorCommissionLedger.create({data:{advisorId:t.advisorId,componentId:c.id,entryType:'allocation',amountCents:split.advisorCents,currencyCode:c.currencyCode,reference:receipt.id,occurredAt:new Date()}});
 if(over>0)await audit(tx,context,'overpayment','TripComponent',c.id,null,{overpaymentCents:over,approvalId:a.approvalId});
 if(collected<c.commissionCents)await tx.task.upsert({where:{taskKey:`short-paid:${c.id}`},update:{status:'open'},create:{taskKey:`short-paid:${c.id}`,tripId:t.id,assigneeId:t.advisorId,title:`Commission short-paid: ${c.title}`,type:'commission_overdue',status:'open',dueAt:new Date()}});
 }await audit(tx,context,'receive','CommissionReceipt',receipt.id,null,{amountCents:input.amountCents});return {id:receipt.id};
 }),
 postClientFundsEntry:(context,input)=>command(context,'postClientFundsEntry',input,'canManagePayments',async tx=>{
 if(!['transfer_planning_fee'].includes(input.entryType))throw new Error('Receipts, supplier payments, refunds and reversals require their dedicated mutation');return postFunds(tx,context,input);
 }),
 reverseEntry:(context,input)=>command(context,'reverseEntry',input,'canManagePayments',async tx=>{
 const e=await tx.clientFundsEntry.findUnique({where:{id:input.entryId}});if(!e||e.entryType==='reversal')throw new Error('Entry cannot be reversed');await trip(tx,e.tripId);if(e.reversedById)throw new Error('Entry already reversed');
 // External cash cannot be reversed by bookkeeping alone.
 if(['receipt','supplier_payment','refund_to_client'].includes(e.entryType))throw new Error('External funds require a corresponding reconciled cash movement');
 return postFunds(tx,context,{tripId:e.tripId,componentId:e.componentId,entryType:'reversal',amountCents:-fundsDelta(e.entryType,e.amountCents),currencyCode:e.currencyCode,reverseOfId:e.id,reason:input.reason});
 }),
 cancelComponent:async(context,input)=>{
  const cancelled=await command(context,'cancelComponent',input,'canManageTrips',async tx=>{
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c||c.bookingStatus==='cancelled')throw new Error('Component not cancellable');await trip(tx,c.tripId);const penalty=penaltyCents(c.sellCents,c.startAt||new Date(),new Date(),Array.isArray(c.cancelPenaltySchedule)?c.cancelPenaltySchedule:[]);
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'cancelled',holdUntil:null}});await closeHoldTask(tx,c.id);await audit(tx,context,'cancel','TripComponent',c.id,{bookingStatus:c.bookingStatus},{bookingStatus:'cancelled',penaltyCents:penalty});return {id:row.id,penaltyCents:penalty,refundableCents:Math.max(0,c.sellCents-penalty)};
  });
  if(!input.refundCents)return cancelled;
  if(!input.paymentId)throw new Error('A refund needs the payment to refund');
  if(!Number.isSafeInteger(input.refundCents)||input.refundCents>cancelled.refundableCents)throw new Error('Refund exceeds the amount refundable after the cancellation penalty');
  const refund=await refundClientPayment(context,{paymentId:input.paymentId,amountCents:input.refundCents,reason:input.reason||'Component cancellation',approvalId:input.approvalId,idempotencyKey:`${input.idempotencyKey}:refund`,componentId:input.componentId});
  return {...cancelled,refund};
 },
 refundClientPayment:(context,input)=>refundClientPayment(context,input),
 writeOffCommission:(context,input)=>command(context,'writeOffCommission',input,'canManageCommissions',async tx=>{
 if(!String(input.reason||'').trim())throw new Error('Reason required');
 const c=await tx.tripComponent.findUnique({where:{id:input.componentId}});if(!c)throw new Error('Component not found');await trip(tx,c.tripId);
 if(!['expected','short_paid'].includes(c.commissionStatus))throw new Error('Only expected or short-paid commission can be written off');
 const got=await tx.commissionAllocation.aggregate({where:{componentId:c.id},_sum:{amountCents:true}});const given=writeOffRemaining(c.commissionCents,got._sum.amountCents||0);
 await consumeManagerApproval(tx,{approvalId:input.approvalId,actorId:context.session.itemId,actionType:'commission_writeoff',targetId:c.id,amountCents:given,reason:String(input.reason),entityType:'TripComponent',entityId:c.id});
 const moved=await tx.tripComponent.updateMany({where:{id:c.id,commissionStatus:c.commissionStatus},data:{commissionStatus:'written_off'}});if(moved.count!==1)throw new Error('Component changed concurrently');
 await audit(tx,context,'write_off','TripComponent',c.id,{commissionStatus:c.commissionStatus},{commissionStatus:'written_off',writtenOffCents:given,reason:input.reason,approvalId:input.approvalId});return {id:c.id,writtenOffCents:given};
 }),
 shareItinerary:(context,input)=>command(context,'shareItinerary',input,'canManageTrips',async tx=>{const t=await trip(tx,input.tripId);const token=randomBytes(32).toString('base64url');await tx.trip.update({where:{id:t.id},data:{itineraryToken:hash(token)}});await audit(tx,context,'share','Trip',t.id,null,{itinerary:'shared'});return {id:t.id,token};}),
 transitionTrip:(context,input)=>command(context,'transitionTrip',input,'canManageTrips',async tx=>{const t=await trip(tx,input.tripId);await transition(tx,context,t,input.status);return {id:t.id,status:input.status};}),
 sweepTripDates:(context,input)=>command(context,'sweepTripDates',input,'canManageTrips',async tx=>{const rows=await tx.trip.findMany({where:{status:{in:['paid_in_full','traveling']}}});let count=0;for(const row of rows){const t=await trip(tx,row.id);if(t.status==='paid_in_full'&&t.startDate&&t.startDate<=new Date()){await transition(tx,context,t,'traveling');count++;}else if(t.status==='traveling'&&t.endDate&&t.endDate<new Date()){await transition(tx,context,t,'completed');count++;}}return {count};}),
};
export async function submitInquiry(_root:any,{input}:any,context:any){
 if(!input.name?.trim()||!/^\S+@\S+\.\S+$/.test(input.email||''))throw new Error('Name and valid email required');
 const row=await guardKeystonePrismaResults(context.prisma as any).inquiry.create({data:{name:input.name.slice(0,200),email:input.email.slice(0,254),phone:input.phone?.slice(0,80)||'',destinations:input.destinations?.slice(0,2000)||'',tripType:input.tripType||'family',partySize:input.partySize||1,budgetCents:integerMoney(input.budgetCents||0),status:'new',source:'website',currencyCode:'USD'}});return {id:row.id};
}
async function proposalForToken(context:any,token:string){if(!token||token.length<32)throw new Error('Proposal not found');const p=await context.prisma.proposal.findFirst({where:{publicToken:hash(token)},include:{options:{include:{items:{orderBy:{sort:'asc'}}}},trip:{select:{id:true,title:true,status:true,currencyCode:true}}}});if(!p||!['sent','viewed','accepted'].includes(p.status))throw new Error('Proposal not found');return p;}
export async function viewProposal(_root:any,{token}:any,context:any){const p=await proposalForToken(context,token);if(p.status==='sent')await guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{const r=await tx.proposal.updateMany({where:{id:p.id,status:'sent'},data:{status:'viewed'}});if(r.count)await audit(tx,context,'view','Proposal',p.id,{status:'sent'},{status:'viewed'});});return {id:p.id,version:p.version,status:p.status,introNote:p.introNote,depositBps:p.depositBps||0,trip:p.trip,options:p.options.map((o:any)=>({id:o.id,title:o.title,items:o.items.map((i:any)=>({id:i.id,title:i.title,details:i.details,kind:i.kind,sellCents:i.sellCents,currencyCode:i.currencyCode}))}))};}
async function acceptedResult(tx:any,p:any,token:string){
 if(!(p.depositBps>0))return {id:p.id,status:'accepted'};
 const inv=await tx.clientInvoice.findFirst({where:{publicToken:hash(depositToken(token))},select:{number:true,status:true}});
 return inv?{id:p.id,status:'accepted',deposit:{invoiceToken:depositToken(token),number:inv.number,paid:inv.status==='paid'}}:{id:p.id,status:'accepted'};
}
export async function acceptProposal(_root:any,{token,optionId,name,idempotencyKey}:any,context:any){
 const proof=await proposalForToken(context,token);if(!name?.trim()||!idempotencyKey)throw new Error('Name and idempotency key required');
 return guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{await trip(tx,proof.tripId);const p=await tx.proposal.findUnique({where:{id:proof.id},include:{options:{include:{items:true}}}});if(p.status==='accepted')return acceptedResult(tx,p,token);if(!['sent','viewed'].includes(p.status))throw new Error('Proposal no longer available');const option=p.options.find((o:any)=>o.id===optionId);if(!option)throw new Error('Option not found');
 const snapshot={proposalId:p.id,version:p.version,optionId,name:name.trim(),acceptedAt:new Date().toISOString(),items:option.items.map((i:any)=>({title:i.title,details:i.details,kind:i.kind,sellCents:i.sellCents,quantity:1,feesCents:0,taxCents:0,currencyCode:i.currencyCode,supplierId:i.supplierId,estimatedCommissionBps:i.estimatedCommissionBps}))};
 await tx.proposal.update({where:{id:p.id},data:{status:'accepted',acceptedByName:name.trim(),acceptedAt:new Date(),acceptedSnapshot:snapshot,acceptedSnapshotHash:hash(JSON.stringify(snapshot))}});
 for(const i of option.items)await tx.tripComponent.create({data:{tripId:p.tripId,supplierId:i.supplierId,title:i.title,kind:i.kind,sellCents:i.sellCents,currencyCode:i.currencyCode,commissionBps:i.estimatedCommissionBps,commissionCents:commissionCents(i.sellCents,i.estimatedCommissionBps),bookingStatus:'quoted',paymentModel:'client_pays_supplier',commissionStatus:'expected',purchaseSnapshot:snapshot.items.find((x:any)=>x.title===i.title)}});
 const t=await tx.trip.findUnique({where:{id:p.tripId}});if(t.status==='proposal_sent')await transition(tx,context,t,'accepted');await audit(tx,context,'accept','Proposal',p.id,{status:p.status},{status:'accepted',snapshotHash:hash(JSON.stringify(snapshot)),depositBps:p.depositBps||0});
 const depositCents=depositCentsFor(option.items,p.depositBps||0);
 if(depositCents>0){const fresh=await tx.trip.findUnique({where:{id:p.tripId}});await createInvoice(tx,context,fresh,[{description:`Deposit · ${option.title} (${(p.depositBps/100).toString()}%)`,amountCents:depositCents,kind:'component_deposit'}],new Date(),depositToken(token));}
 return acceptedResult(tx,p,token);
 });
}
export async function viewItinerary(_root:any,{token}:any,context:any){if(!token||token.length<32)throw new Error('Itinerary not found');const t=await context.prisma.trip.findFirst({where:{itineraryToken:hash(token)},select:{tripNumber:true,title:true,startDate:true,endDate:true,days:{orderBy:{date:'asc'},select:{date:true,title:true,items:{orderBy:{sort:'asc'},select:{title:true,time:true,location:true,notes:true}}}}}});if(!t)throw new Error('Itinerary not found');return t;}
const stripeProvider={id:'stripe-test',code:'pp_stripe',createPaymentFunction:'stripe',getPaymentStatusFunction:'stripe',capturePaymentFunction:'stripe',refundPaymentFunction:'stripe',generatePaymentLinkFunction:'stripe',handleWebhookFunction:'stripe',credentials:{}};
/** Trip share token (itinerary link) or a sent/viewed/accepted proposal token; the same secret opens the client portal. */
async function tripByPortalToken(db:any,token:string){
 if(!token||token.length<32)return null;
 // A party token opens one paying party of a group trip and nothing else.
 const party=await db.tripParty.findFirst({where:{portalToken:hash(token)},select:{id:true,tripId:true,name:true}});if(party?.tripId)return {id:party.tripId,partyId:party.id,partyName:party.name};
 const t=await db.trip.findFirst({where:{itineraryToken:hash(token)},select:{id:true}});if(t)return t;
 const p=await db.proposal.findFirst({where:{publicToken:hash(token),status:{in:['sent','viewed','accepted']}},select:{tripId:true}});
 return p?.tripId?{id:p.tripId}:null;
}
/** An invoice is opened by its own token, or by "p.<invoiceId>.<portal token>" for an invoice of the portal's trip. */
async function findInvoiceByToken(db:any,token:string,extra:any={}){
 if(!token||token.length<32)return null;
 const m=/^p\.([a-z0-9]{20,40})\.(.{32,})$/i.exec(token);
 if(m){const t=await tripByPortalToken(db,m[2]);if(!t)return null;return db.clientInvoice.findFirst({where:{id:m[1],tripId:t.id,partyId:(t as any).partyId??null},...extra});}
 return db.clientInvoice.findFirst({where:{publicToken:hash(token)},...extra});
}
async function invoiceForToken(context:any,token:string){if(!token||token.length<32)throw new Error('Invoice not found');const i=await findInvoiceByToken(context.prisma,token);if(!i||['void','paid'].includes(i.status))throw new Error('Invoice not payable');return i;}
export async function payInvoice(_root:any,{token,idempotencyKey}:any,context:any){
 const {createPayment}=await import('../utils/paymentProviderAdapter');const inv=await invoiceForToken(context,token);if(!idempotencyKey)throw new Error('Idempotency key required');
 const amount=inv.totalCents-inv.collectedCents;const existing=await context.prisma.paymentSession.findUnique({where:{idempotencyKey:`inv:${inv.id}:${idempotencyKey}`}});
 if(existing)return {clientSecret:(existing.data as any).clientSecret,paymentIntentId:(existing.data as any).paymentIntentId,amountCents:existing.amount};
 const intent=await createPayment({provider:stripeProvider,order:{id:inv.id,orderNumber:inv.number},amount,currency:inv.currencyCode,idempotencyKey:`inv:${inv.id}:${idempotencyKey}`});
 await context.prisma.paymentSession.create({data:{amount,currencyCode:inv.currencyCode,idempotencyKey:`inv:${inv.id}:${idempotencyKey}`,paymentCollectionId:inv.paymentCollectionId,isSelected:true,isInitiated:true,data:{clientSecret:intent.clientSecret,paymentIntentId:intent.paymentIntentId}}});
 return {clientSecret:intent.clientSecret,paymentIntentId:intent.paymentIntentId,amountCents:amount};
}
export async function confirmInvoicePayment(_root:any,{token,paymentIntentId}:any,context:any){
 const {getPaymentStatus}=await import('../utils/paymentProviderAdapter');
 // A reload of the return page after the invoice is paid must still say so, not report an error.
 if(token&&token.length>=32&&paymentIntentId){const settled=await findInvoiceByToken(context.prisma,token,{select:{id:true,number:true,status:true}});
  if(settled){const done=await context.prisma.payment.findUnique({where:{idempotencyKey:`stripe:${paymentIntentId}`},select:{id:true,orderId:true,status:true}});
   if(done&&done.orderId===settled.id&&done.status==='succeeded')return {status:'succeeded',invoiceStatus:settled.status,paymentId:done.id,number:settled.number};}}
 const inv=await invoiceForToken(context,token);
 const session=await context.prisma.paymentSession.findFirst({where:{paymentCollectionId:inv.paymentCollectionId,data:{path:['paymentIntentId'],equals:paymentIntentId}}});if(!session)throw new Error('Payment not found');
 const status=await getPaymentStatus({provider:stripeProvider,paymentId:paymentIntentId});if(status.status!=='succeeded'||status.amount!==session.amount||status.currencyCode!==inv.currencyCode)return {status:status.status};
 const {settleInvoicePayment}=await import('../lib/invoice-settlement');
 return settleInvoicePayment(context,{paymentIntentId,amount:status.amount,currencyCode:status.currencyCode,invoiceId:inv.id});
}

const DESTINATION_SELECT={name:true,slug:true,country:true,specialty:true};
export async function publicDestinations(_root:any,_args:any,context:any){return guardKeystonePrismaResults(context.prisma as any).destination.findMany({orderBy:{name:'asc'},select:DESTINATION_SELECT,take:100});}
export async function publicDestination(_root:any,{slug}:any,context:any){if(!/^[a-z0-9-]{1,80}$/.test(slug||''))return null;return guardKeystonePrismaResults(context.prisma as any).destination.findFirst({where:{slug},select:DESTINATION_SELECT});}
const INVOICE_VIEW={number:true,status:true,totalCents:true,collectedCents:true,currencyCode:true,dueAt:true,trip:{select:{title:true,tripNumber:true}},lines:{select:{description:true,amountCents:true,kind:true}}};
export async function viewInvoice(_root:any,{token}:any,context:any){
 if(!token||token.length<32)throw new Error('Invoice not found');
 const i=await findInvoiceByToken(guardKeystonePrismaResults(context.prisma as any),token,{select:INVOICE_VIEW});if(!i||i.status==='draft')throw new Error('Invoice not found');return i;
}
/** Read-only client portal. No traveler, document, supplier or commission data; only what the client already sees on their proposal, itinerary and invoices. */
export async function viewTripPortal(_root:any,{token}:any,context:any){
 const db=guardKeystonePrismaResults(context.prisma as any);const ref=await tripByPortalToken(db,token);if(!ref)throw new Error('Trip not found');
 const t=await db.trip.findUnique({where:{id:ref.id},select:{id:true,tripNumber:true,title:true,status:true,startDate:true,endDate:true,currencyCode:true,
  days:{orderBy:{date:'asc'},select:{date:true,title:true,items:{orderBy:{sort:'asc'},select:{title:true,time:true,location:true,notes:true}}}},
  invoices:{where:{status:{notIn:['draft','void']},partyId:(ref as any).partyId??null},orderBy:{dueAt:'asc'},select:{id:true,number:true,status:true,totalCents:true,collectedCents:true,dueAt:true,currencyCode:true}},
  schedule:{where:{status:'due'},orderBy:{dueAt:'asc'},select:{dueAt:true}},
  rooms:{where:(ref as any).partyId?{partyId:(ref as any).partyId}:{id:'none'},orderBy:{label:'asc'},select:{label:true,roomType:true,guests:{select:{id:true}}}}}});
 if(!t)throw new Error('Trip not found');
 const open=t.invoices.filter((i:any)=>i.status!=='paid'&&i.totalCents>i.collectedCents);
 const balanceCents=open.reduce((n:number,i:any)=>n+(i.totalCents-i.collectedCents),0);
 // The payment schedule is trip-wide, so only the whole-trip view may use it; a party's next due date comes from its own invoices.
 const dates=[...open.map((i:any)=>i.dueAt),...((ref as any).partyId?[]:t.schedule.map((s:any)=>s.dueAt))].filter(Boolean).map((d:any)=>new Date(d).getTime());
 return {...((ref as any).partyId?{partyName:(ref as any).partyName,rooms:t.rooms.map((r:any)=>({label:r.label,roomType:r.roomType,guests:r.guests.length}))}:{}),tripNumber:t.tripNumber,title:t.title,status:t.status,startDate:t.startDate,endDate:t.endDate,currencyCode:t.currencyCode,days:t.days,balanceCents,nextDueAt:dates.length?new Date(Math.min(...dates)).toISOString():null,
  invoices:t.invoices.map((i:any)=>({number:i.number,status:i.status,totalCents:i.totalCents,collectedCents:i.collectedCents,dueAt:i.dueAt,currencyCode:i.currencyCode,payToken:i.status==='paid'?null:`p.${i.id}.${token}`}))};
}
// Customer lookup: both the booking code and the email on file must match; only status data is returned.
export async function lookupBooking(_root:any,{email,code}:any,context:any){
 const mail=String(email||'').trim().toLowerCase(),ref=String(code||'').trim().toUpperCase();
 if(!/^\S+@\S+\.\S+$/.test(mail)||!/^(TR|INV)-[A-Z0-9]{16}$/.test(ref))throw new Error('Booking not found');
 const db=guardKeystonePrismaResults(context.prisma as any);
 const trip=await db.trip.findFirst({where:{client:{email:{equals:mail,mode:'insensitive'}},OR:[{tripNumber:ref},{invoices:{some:{number:ref}}}]},select:{tripNumber:true,title:true,status:true,startDate:true,endDate:true,invoices:{select:{number:true,status:true,totalCents:true,collectedCents:true,currencyCode:true}}}});
 if(!trip)throw new Error('Booking not found');return trip;
}
