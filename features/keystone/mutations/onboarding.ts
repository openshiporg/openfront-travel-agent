import {randomBytes,createHash} from 'node:crypto';
import {permissions} from '../access';
import {commissionCents,advisorSplit} from '../lib/travel-money';
import {guardKeystonePrismaResults} from '../lib/prisma-result';
import seed from '../../platform/onboarding/lib/seed.json';

type Template='full'|'minimal';
const DAY=86400000;
const PHASES=['agency','advisors','suppliers','destinations','clients','inquiries','trips','providers'] as const;
export type SeedPhase=typeof PHASES[number];
const MINIMAL={advisors:1,suppliers:1,clients:1,inquiries:0,trips:1};
const at=(offset:number|null|undefined)=>offset==null?null:new Date(Date.now()+offset*DAY);

function pick(template:Template){
  if(template==='full')return seed as any;
  const s:any=JSON.parse(JSON.stringify(seed));
  s.advisors=s.advisors.slice(0,MINIMAL.advisors);s.suppliers=s.suppliers.slice(0,MINIMAL.suppliers);s.clients=s.clients.slice(0,MINIMAL.clients);s.inquiries=[];
  const supplier=s.suppliers[0].name;
  s.trips=[{title:'First proposal',status:'proposal_sent',client:s.clients[0].name,advisor:0,destinations:[s.destinations[0].name],startOffset:150,endOffset:160,planningFeeCents:s.agency.defaultPlanningFeeCents,travelers:[[s.clients[0].name.split(' ')[0],s.clients[0].name.split(' ').slice(1).join(' ')]],proposals:[{version:1,status:'sent',introNote:'',options:[{title:'Option A',items:[{kind:'hotel',supplier,title:'Hotel, 5 nights',sellCents:300000,estimatedCommissionBps:1200,details:''}]}]}],components:[],invoices:[],receipts:[],itinerary:[]}];
  s.destinations=s.destinations.slice(0,1);
  return s;
}
export function seedPhases(){return [...PHASES];}

export async function ensureTravelOnboardingPhase(context:any,{phase,template}:{phase:SeedPhase;template:Template}){
  if(!permissions.canManageOnboarding({session:context.session}))throw new Error('Not authorized');
  if(!PHASES.includes(phase)||!['full','minimal'].includes(template))throw new Error('Unknown setup phase');
  const s=pick(template);const db=guardKeystonePrismaResults(context.prisma as any);
  const advisorIds=async()=>{const users=await db.user.findMany({where:{email:{in:s.advisors.map((a:any)=>a.email)}}});return s.advisors.map((a:any)=>users.find((u:any)=>u.email===a.email)?.id);};
  let count=0;
  if(phase==='agency'){
    const existing=await db.agencySettings.findFirst();const a=s.agency;
    const data={name:a.name,address:a.address,email:a.email,phone:a.phone,defaultPlanningFeeCents:a.defaultPlanningFeeCents,refundApprovalThresholdCents:a.refundApprovalThresholdCents,hostAgencySplitBps:a.hostAgencySplitBps,currencyCode:a.currencyCode};
    if(existing)await db.agencySettings.update({where:{id:existing.id},data});else await db.agencySettings.create({data});count=1;
  }
  if(phase==='advisors'){
    const roles:Record<string,string>={};
    const perms={canAccessDashboard:true,canSeeOtherPeople:true,canManageTrips:true,canManageClients:true,canManageSuppliers:true,canManageCommissions:true,canManageDocuments:true,canManageTasks:true,canReadPayments:true,canManagePayments:true};
    let role=await db.role.findFirst({where:{name:'Advisor'}});if(!role)role=await db.role.create({data:{name:'Advisor',...perms}});roles.Advisor=role.id;
    const customer=await db.role.findFirst({where:{name:'Customer'}});if(!customer)await db.role.create({data:{name:'Customer'}});
    for(const a of s.advisors){
      if(await db.user.findUnique({where:{email:a.email}}))continue;
      // Keystone hashes the password through the list API; advisors reset it before first sign-in.
      await context.sudo().query.User.createOne({data:{name:a.name,email:a.email,password:randomBytes(24).toString('base64url'),role:{connect:{id:role.id}},onboardingStatus:'dismissed'},query:'id'});count++;
    }
  }
  if(phase==='suppliers'){
    for(const sp of s.suppliers){
      let row=await db.supplier.findFirst({where:{name:sp.name}});
      if(!row)row=await db.supplier.create({data:{name:sp.name,kind:sp.kind,defaultCommissionBps:sp.defaultCommissionBps,commissionPaymentTermsDays:sp.commissionPaymentTermsDays,bookingPortalUrl:sp.bookingPortalUrl,iataCliaNotes:sp.iataCliaNotes}});
      for(const c of sp.contacts)if(!(await db.supplierContact.findFirst({where:{supplierId:row.id,email:c.email}})))await db.supplierContact.create({data:{...c,supplierId:row.id}});count++;
    }
  }
  if(phase==='destinations'){for(const d of s.destinations){if(!(await db.destination.findFirst({where:{slug:d.slug}})))await db.destination.create({data:d});count++;}}
  if(phase==='clients'){for(const c of s.clients){if(!(await db.client.findFirst({where:{email:c.email}})))await db.client.create({data:c});count++;}}
  if(phase==='inquiries'){
    const ids=await advisorIds();
    for(const i of s.inquiries){if(await db.inquiry.findFirst({where:{email:i.email}}))continue;
      await db.inquiry.create({data:{name:i.name,email:i.email,phone:i.phone,tripType:i.tripType,destinations:i.destinations,travelWindowStart:at(i.travelWindowStartOffset),travelWindowEnd:at(i.travelWindowEndOffset),partySize:i.partySize,budgetCents:i.budgetCents,status:i.status,source:i.source,assignedAdvisorId:ids[i.advisor]||null}});count++;}
  }
  if(phase==='trips'){const ids=await advisorIds();for(const t of s.trips){if(await db.$transaction((tx:any)=>seedTrip(tx,s,t,ids),{timeout:60000}))count++;}}
  if(phase==='providers'){
    for(const p of s.paymentProviders){if(await db.paymentProvider.findUnique({where:{code:p.code}}))continue;
      await db.paymentProvider.create({data:{name:p.name,code:p.code,isInstalled:true,createPaymentFunction:p.adapter,capturePaymentFunction:p.adapter,refundPaymentFunction:p.adapter,getPaymentStatusFunction:p.adapter,generatePaymentLinkFunction:p.adapter,handleWebhookFunction:p.adapter}});count++;}
  }
  return {phase,count};
}

async function seedTrip(db:any,s:any,t:any,advisorIds:string[]){
  const client=await db.client.findFirst({where:{name:t.client}});if(!client)throw new Error(`Missing client ${t.client}`);
  if(await db.trip.findFirst({where:{title:t.title,clientId:client.id}}))return false;
  const advisorId=advisorIds[t.advisor]||advisorIds[0]||null;
  const destinations=await db.destination.findMany({where:{name:{in:t.destinations}}});
  const trip=await db.trip.create({data:{tripNumber:`TR-${randomBytes(8).toString('hex').toUpperCase()}`,title:t.title,status:t.status,clientId:client.id,advisorId,startDate:at(t.startOffset),endDate:at(t.endOffset),planningFeeCents:t.planningFeeCents,currencyCode:'USD',destinations:{connect:destinations.map((d:any)=>({id:d.id}))}}});
  const travelers:any[]=[];
  for(const [i,[firstName,lastName]] of t.travelers.entries())travelers.push(await db.traveler.create({data:{firstName,lastName,clientId:client.id,nationality:'US',passportOnFile:i===0,passportExpiresAt:at(900+i*30),trips:{connect:{id:trip.id}}}}));
  const supplierId=async(name:string|null)=>name?(await db.supplier.findFirst({where:{name}}))?.id||null:null;
  for(const p of t.proposals){
    const prop=await db.proposal.create({data:{tripId:trip.id,version:p.version,status:p.status,introNote:p.introNote,sentAt:p.status!=='draft'?new Date():null,acceptedAt:p.status==='accepted'?new Date():null,acceptedByName:p.acceptedBy||''}});
    for(const [oi,o] of p.options.entries()){const opt=await db.proposalOption.create({data:{proposalId:prop.id,title:o.title,sort:oi}});
      for(const [ii,it] of o.items.entries())await db.proposalItem.create({data:{optionId:opt.id,kind:it.kind,supplierId:await supplierId(it.supplier),title:it.title,details:it.details,sellCents:it.sellCents,estimatedCommissionBps:it.estimatedCommissionBps,sort:ii,currencyCode:'USD'}});}
    if(p.status==='accepted'){const snap={proposalId:prop.id,version:p.version,acceptedAt:new Date().toISOString(),name:p.acceptedBy};await db.proposal.update({where:{id:prop.id},data:{acceptedSnapshot:snap,acceptedSnapshotHash:createHash('sha256').update(JSON.stringify(snap)).digest('hex')}});}
  }
  const comps:Record<string,any>={};
  for(const c of t.components){
    const cents=commissionCents(c.sellCents,c.commissionBps);
    comps[c.title]=await db.tripComponent.create({data:{tripId:trip.id,supplierId:await supplierId(c.supplier),kind:c.kind,title:c.title,startAt:at(c.startOffset),endAt:at(c.endOffset),confirmationNumber:c.bookingStatus==='quoted'?'':`CF${randomBytes(4).toString('hex').toUpperCase()}`,sellCents:c.sellCents,netCostCents:c.netCostCents,paymentModel:c.paymentModel,bookingStatus:c.bookingStatus,depositCents:c.depositCents,depositDueAt:at(c.depositDueOffset),finalDueAt:at(c.finalDueOffset),cancellationPolicy:c.cancellationPolicy,cancelPenaltySchedule:c.cancelPenaltySchedule,commissionBps:c.commissionBps,commissionCents:cents,commissionStatus:c.commissionStatus,currencyCode:'USD',travelers:{connect:travelers.map(x=>({id:x.id}))},purchaseSnapshot:{title:c.title,sellCents:c.sellCents,netCostCents:c.netCostCents,quantity:1,feesCents:0,taxCents:0,commissionCents:cents,currencyCode:'USD'}}});
    for(const [kind,amount,due] of [['component_deposit',c.depositCents,c.depositDueOffset],['component_final',c.sellCents-c.depositCents,c.finalDueOffset]] as any[]){
      if(c.paymentModel!=='agency_collects'||!amount||due==null)continue;
      const key=`${comps[c.title].id}:${kind}`;await db.paymentSchedule.create({data:{scheduleKey:key,tripId:trip.id,componentId:comps[c.title].id,kind,amountCents:amount,dueAt:at(due),status:t.status==='cancelled'?'cancelled':due<0?'paid':'due',currencyCode:'USD'}});
      await db.task.create({data:{taskKey:`reminder:${key}`,tripId:trip.id,assigneeId:advisorId,title:kind==='component_final'?'Final payment due':'Deposit due',type:kind==='component_final'?'final_due':'deposit_due',dueAt:at(due-7),status:t.status==='cancelled'?'cancelled':due<0?'completed':'open'}});}
    if(c.supplierPaidCents)await db.supplierPayment.create({data:{componentId:comps[c.title].id,amountCents:c.supplierPaidCents,paidAt:new Date(),method:'wire',reference:`WIRE-${randomBytes(4).toString('hex').toUpperCase()}`,currencyCode:'USD'}});
  }
  let received=0,supplierPaid=0;
  for(const inv of t.invoices){
    const total=inv.lines.reduce((n:number,l:any)=>n+l[2],0);const status=inv.paidCents>=total?'paid':inv.paidCents>0?'partially_paid':'sent';
    const collection=await db.paymentCollection.create({data:{amount:total,currencyCode:'USD'}});
    const row=await db.clientInvoice.create({data:{tripId:trip.id,number:`INV-${randomBytes(8).toString('hex').toUpperCase()}`,status,totalCents:total,collectedCents:inv.paidCents,dueAt:new Date(),currencyCode:'USD',paymentCollectionId:collection.id}});
    for(const [kind,description,amount] of inv.lines)await db.clientInvoiceLine.create({data:{invoiceId:row.id,kind,description,amountCents:amount,unitPriceCents:amount,quantity:1,feesCents:0,taxCents:0,currencyCode:'USD',snapshot:{description,amountCents:amount,quantity:1,feesCents:0,taxCents:0,kind}}});
    if(inv.paidCents>0){
      const pay=await db.payment.create({data:{orderId:row.id,paymentCollectionId:collection.id,amount:inv.paidCents,currencyCode:'USD',status:'succeeded',paymentMethod:'credit_card',idempotencyKey:`seed:${row.id}`,processedAt:new Date()}});
      await db.clientFundsEntry.create({data:{tripId:trip.id,entryType:'receipt',amountCents:inv.paidCents,currencyCode:'USD',reference:pay.id,reason:'',occurredAt:new Date(),entryKey:`receipt:${pay.id}`}});received+=inv.paidCents;
      const fee=inv.lines.find((l:any)=>l[0]==='planning_fee');
      if(fee&&status==='paid')await db.clientFundsEntry.create({data:{tripId:trip.id,entryType:'transfer_planning_fee',amountCents:fee[2],currencyCode:'USD',reference:row.id,reason:'Planning fee earned',occurredAt:new Date(),entryKey:`fee:${row.id}`}});
    }
  }
  for(const c of t.components)if(c.supplierPaidCents)await db.clientFundsEntry.create({data:{tripId:trip.id,componentId:comps[c.title].id,entryType:'supplier_payment',amountCents:c.supplierPaidCents,currencyCode:'USD',reference:'supplier payment',reason:'',occurredAt:new Date(),entryKey:`sp:${comps[c.title].id}`}});
  for(const r of t.receipts){
    const sid=await supplierId(r.supplier);const receipt=await db.commissionReceipt.create({data:{supplierId:sid,amountCents:r.amountCents,receivedAt:new Date(),reference:`CR-${randomBytes(4).toString('hex').toUpperCase()}`,currencyCode:'USD'}});
    for(const [title,amount] of r.allocations){const comp=comps[title];await db.commissionAllocation.create({data:{receiptId:receipt.id,componentId:comp.id,amountCents:amount,currencyCode:'USD'}});
      const split=advisorSplit(amount,s.agency.hostAgencySplitBps);await db.advisorCommissionLedger.create({data:{advisorId,componentId:comp.id,entryType:'allocation',amountCents:split.advisorCents,currencyCode:'USD',reference:receipt.id,occurredAt:new Date()}});
      if(amount<comp.commissionCents)await db.task.create({data:{taskKey:`short-paid:${comp.id}`,tripId:trip.id,assigneeId:advisorId,title:`Commission short-paid: ${title}`,type:'commission_overdue',status:'open',dueAt:new Date()}});}
  }
  if(t.itinerary.length){
    for(const d of t.itinerary){const day=await db.itineraryDay.create({data:{tripId:trip.id,date:at(d.dayOffset),title:d.title}});
      for(const [i,it] of d.items.entries())await db.itineraryItem.create({data:{dayId:day.id,title:it.title,time:it.time,location:it.location,notes:'',sort:i}});}
  }
  void received;void supplierPaid;
  return true;
}

export async function setOnboardingStatus(_root:any,{status}:{status:string},context:any){
  if(!permissions.canManageOnboarding({session:context.session}))throw new Error('Not authorized');
  if(!['not_started','in_progress','completed','dismissed'].includes(status))throw new Error('Invalid status');
  const u=await context.prisma.user.update({where:{id:context.session.itemId},data:{onboardingStatus:status}});return {id:u.id,onboardingStatus:u.onboardingStatus};
}
