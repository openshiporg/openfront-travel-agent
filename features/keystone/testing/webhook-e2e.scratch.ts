/**
 * Opt-in scratch test, never part of `npm test`. Proves the signed Stripe webhook route over HTTP against a scratch database.
 *   DATABASE_URL=<scratch> STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_depth_<anything> BASE=http://localhost:<port> \
 *     npx tsx features/keystone/testing/webhook-e2e.scratch.ts      (with `next dev -p <port>` running against the same env)
 * The secret must start with whsec_depth_ so a real secret can never be used here. Fixtures are titled "Depth ..." and removed afterwards.
 */
import {PrismaClient} from '@prisma/client'
import Stripe from 'stripe'
import {operators} from '../mutations/travel'
import {cleanupDepthFixtures} from './cleanup.scratch'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const BASE=process.env.BASE!, SECRET=process.env.STRIPE_WEBHOOK_SECRET!
assert.ok(SECRET.startsWith('whsec_depth_'),'run with the test-only secret')
const stripe=new Stripe('sk_test_unused_for_signing')
const p=new PrismaClient(), keys:string[]=[]
const gql=async(query:string,variables:any)=>{const r=await fetch(BASE+'/api/graphql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables})});const j:any=await r.json();if(j.errors)throw new Error(j.errors.map((e:any)=>e.message).join('; '));return j.data}
const post=async(raw:string,sig?:string,provider='pp_stripe')=>{const r=await fetch(`${BASE}/api/integrations/payment/${provider}/webhook`,{method:'POST',headers:{'content-type':'application/json',...(sig?{'stripe-signature':sig}:{})},body:raw});return {status:r.status,body:await r.json().catch(()=>null) as any}}
const sign=(raw:string,secret=SECRET)=>stripe.webhooks.generateTestHeaderString({payload:raw,secret})
const evt=(id:string,pi:string,inv:string,patch:any={})=>JSON.stringify({id,object:'event',type:'payment_intent.succeeded',livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:pi,object:'payment_intent',status:'succeeded',amount:20000,amount_received:20000,currency:'usd',metadata:{orderId:inv,orderNumber:''},...(patch.object||{})}},...(patch.top||{})})
async function main(){
 const user=await p.user.findFirstOrThrow(),client=await p.client.findFirstOrThrow()
 const t=await p.trip.create({data:{title:'Depth webhook',tripNumber:'TR-'+randomUUID(),advisorId:user.id,clientId:client.id}})
 const ctx:any={prisma:p,session:{itemId:user.id,data:{role:{canManageTrips:true,canManagePayments:true}}}}
 const issue=()=>(operators as any).issueClientInvoice(ctx,{tripId:t.id,idempotencyKey:randomUUID(),lines:[{description:'Deposit',amountCents:20000,kind:'component_deposit'}]})
 const start=async(tok:string)=>(await gql('mutation($t:String!,$k:String!){payInvoice(token:$t,idempotencyKey:$k)}',{t:tok,k:randomUUID()})).payInvoice
 const a=await issue(), s=await start(a.token); const pi=s.paymentIntentId; assert.match(pi,/^pi_/)
 const e1='evt_depth_'+randomUUID().slice(0,8); keys.push('pp_stripe:'+e1)
 const raw=evt(e1,pi,a.id)
 // 1. tampered body (amount edited after signing), wrong secret, missing and malformed signatures, unknown provider
 const sig=sign(raw)
 assert.equal((await post(raw.replace('"amount_received":20000','"amount_received":1'),sig)).status,400)
 assert.equal((await post(raw,sign(raw,'whsec_depth_wrong'))).status,400)
 assert.equal((await post(raw)).status,400)
 assert.equal((await post(raw,'t=1,v1=deadbeef')).status,400)
 const old=stripe.webhooks.generateTestHeaderString({payload:raw,secret:SECRET,timestamp:Math.floor(Date.now()/1000)-3600});assert.equal((await post(raw,old)).status,400,'stale timestamp')
 assert.equal((await post(raw,sig,'pp_other')).status,404)
 const inv0=await p.clientInvoice.findUniqueOrThrow({where:{id:a.id}});assert.equal(inv0.status,'sent');assert.equal(await p.payment.count({where:{orderId:a.id}}),0);assert.equal(await p.paymentWebhookEvent.count({where:{eventKey:'pp_stripe:'+e1}}),0,'rejected requests leave no inbox row')
 // 2. valid signed event settles
 const ok=await post(raw,sig);assert.deepEqual([ok.status,ok.body.status],[200,'processed'])
 const inv=await p.clientInvoice.findUniqueOrThrow({where:{id:a.id}});assert.deepEqual([inv.status,inv.collectedCents],['paid',20000])
 const pays=await p.payment.findMany({where:{orderId:a.id}});assert.equal(pays.length,1);assert.equal(pays[0].providerPaymentId,pi)
 const inbox=await p.paymentWebhookEvent.findUniqueOrThrow({where:{eventKey:'pp_stripe:'+e1}});assert.deepEqual([inbox.status,inbox.paymentId],['processed',pays[0].id])
 // 3. replay of the same event, and a retry under a different event id for the same intent, both dedupe
 const rep=await post(raw,sign(raw));assert.deepEqual([rep.status,rep.body.status],[200,'processed'])
 const e2='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e2);const raw2=evt(e2,pi,a.id);const rep2=await post(raw2,sign(raw2));assert.equal(rep2.status,200)
 assert.equal(await p.payment.count({where:{orderId:a.id}}),1);assert.equal(await p.clientFundsEntry.count({where:{tripId:t.id}}),1);assert.equal(await p.auditEvent.count({where:{targetId:pays[0].id,action:'receive'}}),1);assert.equal((await p.clientInvoice.findUniqueOrThrow({where:{id:a.id}})).collectedCents,20000)
 // 4. concurrent delivery of a fresh event settles exactly once
 const b=await issue(), sb=await start(b.token); const e3='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e3);const raw3=evt(e3,sb.paymentIntentId,b.id)
 const rs=await Promise.all([1,2,3,4].map(()=>post(raw3,sign(raw3))));console.log('concurrent statuses',rs.map(r=>r.status).join(','))
 assert.ok(rs.some(r=>r.status===200));assert.equal(await p.payment.count({where:{orderId:b.id}}),1);assert.equal((await p.clientInvoice.findUniqueOrThrow({where:{id:b.id}})).collectedCents,20000)
 // 5. validly signed but wrong amount / live mode / unknown intent never settle
 const c=await issue(), sc=await start(c.token);const e4='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e4)
 const bad=evt(e4,sc.paymentIntentId,c.id,{object:{amount_received:100,amount:100}});assert.equal((await post(bad,sign(bad))).status,400)
 assert.equal((await p.paymentWebhookEvent.findUniqueOrThrow({where:{eventKey:'pp_stripe:'+e4}})).status,'failed')
 const live=evt('evt_depth_live_'+randomUUID().slice(0,6),sc.paymentIntentId,c.id,{top:{livemode:true}});assert.equal((await post(live,sign(live))).status,400)
 const e5='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e5);const ghost=evt(e5,'pi_depth_unknown',c.id);assert.equal((await post(ghost,sign(ghost))).status,400)
 assert.equal(await p.payment.count({where:{orderId:c.id}}),0);assert.equal((await p.clientInvoice.findUniqueOrThrow({where:{id:c.id}})).status,'sent')
 // 6. the failed (wrong amount) event does not block the genuine one afterwards
 const e6='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e6);const good=evt(e6,sc.paymentIntentId,c.id,{object:{amount:20000,amount_received:20000}});assert.equal((await post(good,sign(good))).status,200);assert.equal((await p.clientInvoice.findUniqueOrThrow({where:{id:c.id}})).status,'paid')
 // 7. unrelated verified event types are acknowledged and ignored
 const e7='evt_depth_'+randomUUID().slice(0,8);keys.push('pp_stripe:'+e7);const other=evt(e7,pi,a.id,{top:{type:'payment_intent.created'}});const ig=await post(other,sign(other));assert.deepEqual([ig.status,ig.body.status],[200,'ignored'])
 console.log('PASS signed webhook over HTTP: tampered/wrong-secret/unsigned/stale/unknown-provider refused with no inbox row; valid settles once; replay and second event id dedupe; 4 concurrent deliveries -> 1 payment; wrong amount/live/unknown intent never settle; genuine event after a failed one settles; other types ignored')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await p.paymentWebhookEvent.deleteMany({where:{eventKey:{in:keys}}}).catch(()=>{});await cleanupDepthFixtures(p).catch(e=>console.error('cleanup failed',e.message));await p.$disconnect()})
