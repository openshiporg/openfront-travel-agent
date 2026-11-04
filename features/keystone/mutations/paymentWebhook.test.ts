import test from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'
import {handleTravelPaymentWebhook} from './paymentWebhook'
process.env.STRIPE_SECRET_KEY='sk_test_depth_local'
process.env.STRIPE_WEBHOOK_SECRET='whsec_depth_local'
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)
const payload=(patch:any={})=>JSON.stringify({id:'evt_depth',type:'payment_intent.succeeded',livemode:false,data:{object:{id:'pi_depth',status:'succeeded',amount_received:1000,currency:'usd',metadata:{orderId:'invoice'}}},...patch})
const headers=(raw:string)=>({'stripe-signature':stripe.webhooks.generateTestHeaderString({payload:raw,secret:process.env.STRIPE_WEBHOOK_SECRET!})})
test('invalid signature is refused before touching database',async()=>{await assert.rejects(()=>handleTravelPaymentWebhook({prisma:{}},payload(),{'stripe-signature':'invalid'}),/signature/);const raw=payload();await assert.rejects(()=>handleTravelPaymentWebhook({prisma:{}},raw+' ',headers(raw)),/signature/)})
test('live events fail closed',async()=>{const raw=payload({livemode:true});await assert.rejects(()=>handleTravelPaymentWebhook({prisma:{}},raw,headers(raw)),/Live/)})
test('valid unsupported event is durably ignored; refund event stays failed for review',async()=>{
 for(const type of ['payment_intent.created','refund.updated']){
  const updates:any[]=[];const context={prisma:{paymentWebhookEvent:{upsert:async()=>({id:'inbox',status:'received'}),update:async({data}:any)=>{updates.push(data);return data}}}};
  const raw=payload({type});const result=await handleTravelPaymentWebhook(context,raw,headers(raw));assert.equal(result.success,type==='payment_intent.created');assert.equal(updates.at(-1).status,type==='refund.updated'?'failed':'ignored')
 }
})
