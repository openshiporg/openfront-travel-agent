import {randomBytes,createHash} from 'node:crypto';
import {guardKeystonePrismaResults} from '../lib/prisma-result';
import {permissions, type Permission} from '../access';
import {getOrCreateIdempotencyAttempt,updateIdempotencyAttempt} from '../utils/idempotency';
import {commissionCents,advisorSplit,penaltyCents,fundsAfter,supplierRemainder,fundsDelta,integerMoney,assertTransition,refundableRemaining,assertRefundAmount,requiresApproval,overpaymentCents,writeOffRemaining} from '../lib/travel-money';
import {consumeManagerApproval} from '../utils/managerApproval';
import {assertObjectStorageConfigured,signObjectRequest,verifyUploadedObject,type ObjectMetadata} from '../../integrations/storage';
import {planningAmount,componentTerms,syncPaymentSchedule} from '../lib/trip-planning';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const code=(prefix:string)=>`${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
export async function lockTransactionKey(tx:any,key:string){await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS acquired`;}
function authorize(context:any,permission:Permission){if(!permissions[permission]({session:context.session}))throw new Error('Not authorized');}
async function audit(tx:any,context:any,action:string,list:string,id:string,before:any,after:any){await tx.auditEvent.create({data:{actorId:context.session?.itemId||null,action,targetList:list,targetId:id,before:before?JSON.parse(JSON.stringify(before)):undefined,after:after?JSON.parse(JSON.stringify(after)):undefined,requestId:randomBytes(12).toString('hex')}});}
async function command(context:any,operation:string,input:any,permission:Permission,run:(tx:any)=>Promise<any>){
 authorize(context,permission);if(!input.idempotencyKey?.trim())throw new Error('Idempotency key required');
 return guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{
  await lockTransactionKey(tx,`travel-idempotency:${input.idempotencyKey}`);
  const {attempt,replay}=await getOrCreateIdempotencyAttempt(tx,{key:input.idempotencyKey,requestPath:operation,requestParams:{...input,actorId:context.session.itemId}});
  if(replay&&attempt.recoveryPoint==='completed')return attempt.responseBody;
  const result=await run(tx);const json=JSON.parse(JSON.stringify(result));
  await updateIdempotencyAttempt(tx,attempt.id,'completed',json,200);return json;
 },{timeout:20000});
}
async function createProposalOptions(tx:any,proposalId:string,options:any[],currencyCode:string){
 for(const [sort,option] of options.entries()){
  if(!String(option.title||'').trim())throw new Error('Option title required');
  const o=await tx.proposalOption.create({data:{proposalId,title:option.title,sort}});
  for(const [index,item] of (option.items||[]).entries()){integerMoney(item.sellCents);commissionCents(item.sellCents,item.estimatedCommissionBps||0);await tx.proposalItem.create({data:{optionId:o.id,title:item.title,kind:item.kind,supplierId:item.supplierId||null,details:item.details||'',sellCents:item.sellCents,estimatedCommissionBps:item.estimatedCommissionBps||0,sort:index,currencyCode}});}
 }
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
const DOCUMENT_TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain']);
const DOCUMENT_KINDS=['passport','visa','insurance','supplier_confirmation','signed_terms'];
const MAX_DOCUMENT_BYTES=25*1024*1024;
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
  authorize(context,'canManageDocuments');assertObjectStorageConfigured();
  const fileName=String(input.fileName||'').trim().replace(/[^A-Za-z0-9._-]+/g,'-');if(!fileName||fileName.startsWith('.'))throw new Error('File name is invalid');
  const mimeType=String(input.mimeType||'').trim().toLowerCase();if(!DOCUMENT_TYPES.has(mimeType))throw new Error('This file type is not allowed; use PDF, JPEG, PNG, WebP or plain text');
  if(!Number.isSafeInteger(input.byteSize)||input.byteSize<1||input.byteSize>MAX_DOCUMENT_BYTES)throw new Error('File size must be between 1 byte and 25 MB');
  const checksumSha256=String(input.checksumSha256||'').trim().toLowerCase();if(!/^[a-f0-9]{64}$/.test(checksumSha256))throw new Error('SHA-256 checksum must be 64 hexadecimal characters');
  if(!DOCUMENT_KINDS.includes(input.kind))throw new Error('Choose a document kind');
  const title=String(input.title||'').trim();if(!title)throw new Error('Title required');
  const doc=await command(context,'requestDocumentUpload',input,'canManageDocuments',async tx=>{
   const t=await trip(tx,input.tripId);await documentTrip(tx,context,t.id);
   if(input.travelerId&&!(await tx.traveler.findFirst({where:{id:String(input.travelerId),trips:{some:{id:t.id}}}})))throw new Error('Traveler is not on this trip');
   const d=await tx.document.create({data:{title,kind:input.kind,tripId:t.id,travelerId:input.travelerId||null,mimeType,byteSize:input.byteSize,checksumSha256,storageKey:`trips/${t.id}/documents/${randomBytes(16).toString('hex')}/${fileName}`}});
   await audit(tx,context,'request_upload','Document',d.id,null,{title,kind:input.kind,mimeType,byteSize:input.byteSize,checksumSha256});return {id:d.id,storageKey:d.storageKey};
  });
  const signed=signObjectRequest('PUT',objectOf({...doc,storageKey:doc.storageKey,mimeType,byteSize:input.byteSize,checksumSha256}));
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
 const data={firstName,lastName,nationality};const row=old?await tx.traveler.update({where:{id:old.id},data}):await tx.traveler.create({data:{...data,clientId:t.clientId,trips:{connect:{id:t.id}}}});
 await audit(tx,context,'edit_traveler','Traveler',row.id,old?{firstName:old.firstName,lastName:old.lastName,nationality:old.nationality}:null,data);return {id:row.id};
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
 const p=await tx.proposal.create({data:{tripId:input.tripId,version:(prior._max.version||0)+1,status:'draft',introNote:input.introNote||''}});
 await createProposalOptions(tx,p.id,input.options,input.currencyCode||'USD');
 await audit(tx,context,'build','Proposal',p.id,null,p);return p;
 }),
 completeTask:(context,input)=>command(context,'completeTask',input,'canManageTasks',async tx=>{
 const found=await tx.task.findUnique({where:{id:String(input.taskId||'')}});if(!found)throw new Error('Task not found');
 if(found.tripId)await trip(tx,found.tripId);
 const task=await tx.task.findUnique({where:{id:found.id}});
 if(task.assigneeId&&task.assigneeId!==context.session.itemId&&!permissions.canManageRoles({session:context.session}))throw new Error('Only the assignee or a manager can complete this task');
 if(task.status==='completed')return {id:task.id,status:'completed',alreadyCompleted:true};
 if(task.status!=='open')throw new Error('Only open tasks can be completed');
 const done=await tx.task.updateMany({where:{id:task.id,status:'open'},data:{status:'completed'}});if(done.count!==1)throw new Error('Task changed; reload and try again');
 await audit(tx,context,'complete','Task',task.id,{status:'open'},{status:'completed',title:task.title,type:task.type});return {id:task.id,status:'completed'};
 }),
 updateProposalDraft:(context,input)=>command(context,'updateProposalDraft',input,'canManageTrips',async tx=>{
 const found=await tx.proposal.findUnique({where:{id:input.proposalId}});if(!found)throw new Error('Proposal not found');await trip(tx,found.tripId);
 const p=await tx.proposal.findUnique({where:{id:input.proposalId},include:{options:{include:{items:true}}}});if(p.status!=='draft')throw new Error('Only draft proposals can be edited');
 if(!Array.isArray(input.options)||!input.options.length)throw new Error('Proposal options required');
 const before={introNote:p.introNote,options:p.options.map((o:any)=>({title:o.title,items:o.items.map((i:any)=>({title:i.title,kind:i.kind,sellCents:i.sellCents,estimatedCommissionBps:i.estimatedCommissionBps}))}))};
 await tx.proposalItem.deleteMany({where:{optionId:{in:p.options.map((o:any)=>o.id)}}});await tx.proposalOption.deleteMany({where:{proposalId:p.id}});
 await createProposalOptions(tx,p.id,input.options,input.currencyCode||'USD');await tx.proposal.update({where:{id:p.id},data:{introNote:String(input.introNote||'').trim()}});
 await audit(tx,context,'edit_draft','Proposal',p.id,before,{introNote:input.introNote||'',options:input.options});return {id:p.id,version:p.version};
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
 const t=await trip(tx,input.tripId);const result=await syncPaymentSchedule(tx,t);await audit(tx,context,'schedule','Trip',t.id,null,result);return result;
 }),
 issueClientInvoice:(context,input)=>command(context,'issueClientInvoice',input,'canManagePayments',async tx=>{
 const t=await trip(tx,input.tripId);if(!input.lines?.length)throw new Error('Invoice lines required');let total=0;
 for(const l of input.lines){integerMoney(l.amountCents);total+=l.amountCents;}integerMoney(total);const token=randomBytes(32).toString('base64url');
 const collection=await tx.paymentCollection.create({data:{amount:total,currencyCode:t.currencyCode}});
 const invoice=await tx.clientInvoice.create({data:{tripId:t.id,number:code('INV'),status:'sent',totalCents:total,collectedCents:0,dueAt:input.dueAt?new Date(input.dueAt):new Date(),publicToken:hash(token),currencyCode:t.currencyCode,paymentCollectionId:collection.id}});
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
 const row=await tx.tripComponent.update({where:{id:c.id},data:{bookingStatus:'cancelled'}});await audit(tx,context,'cancel','TripComponent',c.id,{bookingStatus:c.bookingStatus},{bookingStatus:'cancelled',penaltyCents:penalty});return {id:row.id,penaltyCents:penalty,refundableCents:Math.max(0,c.sellCents-penalty)};
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
export async function viewProposal(_root:any,{token}:any,context:any){const p=await proposalForToken(context,token);if(p.status==='sent')await guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{const r=await tx.proposal.updateMany({where:{id:p.id,status:'sent'},data:{status:'viewed'}});if(r.count)await audit(tx,context,'view','Proposal',p.id,{status:'sent'},{status:'viewed'});});return {id:p.id,version:p.version,status:p.status,introNote:p.introNote,trip:p.trip,options:p.options.map((o:any)=>({id:o.id,title:o.title,items:o.items.map((i:any)=>({id:i.id,title:i.title,details:i.details,kind:i.kind,sellCents:i.sellCents,currencyCode:i.currencyCode}))}))};}
export async function acceptProposal(_root:any,{token,optionId,name,idempotencyKey}:any,context:any){
 const proof=await proposalForToken(context,token);if(!name?.trim()||!idempotencyKey)throw new Error('Name and idempotency key required');
 return guardKeystonePrismaResults(context.prisma as any).$transaction(async(tx:any)=>{await trip(tx,proof.tripId);const p=await tx.proposal.findUnique({where:{id:proof.id},include:{options:{include:{items:true}}}});if(p.status==='accepted')return {id:p.id,status:'accepted'};if(!['sent','viewed'].includes(p.status))throw new Error('Proposal no longer available');const option=p.options.find((o:any)=>o.id===optionId);if(!option)throw new Error('Option not found');
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
 const {settleInvoicePayment}=await import('../lib/invoice-settlement');
 return settleInvoicePayment(context,{paymentIntentId,amount:status.amount,currencyCode:status.currencyCode,invoiceId:inv.id});
}

const DESTINATION_SELECT={name:true,slug:true,country:true,specialty:true};
export async function publicDestinations(_root:any,_args:any,context:any){return guardKeystonePrismaResults(context.prisma as any).destination.findMany({orderBy:{name:'asc'},select:DESTINATION_SELECT,take:100});}
export async function publicDestination(_root:any,{slug}:any,context:any){if(!/^[a-z0-9-]{1,80}$/.test(slug||''))return null;return guardKeystonePrismaResults(context.prisma as any).destination.findFirst({where:{slug},select:DESTINATION_SELECT});}
const INVOICE_VIEW={number:true,status:true,totalCents:true,collectedCents:true,currencyCode:true,dueAt:true,trip:{select:{title:true,tripNumber:true}},lines:{select:{description:true,amountCents:true,kind:true}}};
export async function viewInvoice(_root:any,{token}:any,context:any){
 if(!token||token.length<32)throw new Error('Invoice not found');
 const i=await guardKeystonePrismaResults(context.prisma as any).clientInvoice.findFirst({where:{publicToken:hash(token)},select:INVOICE_VIEW});if(!i||i.status==='draft')throw new Error('Invoice not found');return i;
}
// Customer lookup: both the booking code and the email on file must match; only status data is returned.
export async function lookupBooking(_root:any,{email,code}:any,context:any){
 const mail=String(email||'').trim().toLowerCase(),ref=String(code||'').trim().toUpperCase();
 if(!/^\S+@\S+\.\S+$/.test(mail)||!/^(TR|INV)-[A-Z0-9]{16}$/.test(ref))throw new Error('Booking not found');
 const db=guardKeystonePrismaResults(context.prisma as any);
 const trip=await db.trip.findFirst({where:{client:{email:{equals:mail,mode:'insensitive'}},OR:[{tripNumber:ref},{invoices:{some:{number:ref}}}]},select:{tripNumber:true,title:true,status:true,startDate:true,endDate:true,invoices:{select:{number:true,status:true,totalCents:true,collectedCents:true,currencyCode:true}}}});
 if(!trip)throw new Error('Booking not found');return trip;
}
