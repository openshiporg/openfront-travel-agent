import {handleWebhookFunction} from '../../integrations/payment/stripe'
import {settleInvoicePayment} from '../lib/invoice-settlement'
import {guardKeystonePrismaResults} from '../lib/prisma-result'

/** Restaurant raw-byte verification + durable inbox pattern, adapted to travel invoices. */
export async function handleTravelPaymentWebhook(context:any, rawBody:string, headers:Record<string,string>) {
 if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Stripe TEST configuration required')
 const verified=await handleWebhookFunction({event:null,headers,rawBody})
 const event=verified.event as any
 if(event.livemode)throw new Error('Live payments are not enabled')
 const db=guardKeystonePrismaResults(context.prisma as any)
 const eventKey=`pp_stripe:${event.id}`
 const inbox=await db.paymentWebhookEvent.upsert({where:{eventKey},update:{},create:{eventKey,providerCode:'pp_stripe',providerEventId:event.id,eventType:event.type,status:'received',payload:{id:event.id,type:event.type,resourceId:(verified.resource as any)?.id},attempts:0}})
 if(['processed','ignored'].includes(inbox.status))return {success:true,status:inbox.status}
 await db.paymentWebhookEvent.update({where:{id:inbox.id},data:{attempts:{increment:1}}})
 if(event.type!=='payment_intent.succeeded'){
  // Refunds require original refund reservations; never acknowledge them as reconciled.
  const unsupported=event.type.startsWith('refund.')||event.type==='charge.refunded'
  await db.paymentWebhookEvent.update({where:{id:inbox.id},data:{status:unsupported?'failed':'ignored',error:unsupported?'Refund reconciliation requires operator review':'',processedAt:unsupported?null:new Date()}})
  return {success:!unsupported,status:unsupported?'failed':'ignored'}
 }
 try{
  const intent=verified.resource as any
  if(intent.status!=='succeeded'||!intent.metadata?.orderId)throw new Error('Invoice correlation missing')
  const result=await settleInvoicePayment(context,{paymentIntentId:intent.id,amount:intent.amount_received,currencyCode:String(intent.currency).toUpperCase(),invoiceId:intent.metadata.orderId})
  await db.paymentWebhookEvent.update({where:{id:inbox.id},data:{status:'processed',paymentId:result.paymentId,processedAt:new Date(),error:''}})
  return {success:true,status:'processed'}
 }catch(error){await db.paymentWebhookEvent.update({where:{id:inbox.id},data:{status:'failed',error:'Invoice correlation or settlement failed; retry verified event'}});throw error}
}
