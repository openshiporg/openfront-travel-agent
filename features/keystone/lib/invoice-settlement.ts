import {guardKeystonePrismaResults} from './prisma-result'
import {assertMove} from './stateMachines'
import {settleScheduleRows} from './trip-planning'
import {lockTransactionKey} from '../mutations/travel'

/** Verified provider observation only. Caller must authenticate provider or fetch provider status. */
export async function settleInvoicePayment(context:any, observation:{paymentIntentId:string;amount:number;currencyCode:string;invoiceId?:string}) {
 const db=guardKeystonePrismaResults(context.prisma as any)
 return db.$transaction(async(tx:any)=>{
  const session=await tx.paymentSession.findFirst({where:{data:{path:['paymentIntentId'],equals:observation.paymentIntentId}}})
  if(!session)throw new Error('Payment session not found; retry webhook')
  const inv=await tx.clientInvoice.findFirst({where:{paymentCollectionId:session.paymentCollectionId}})
  if(!inv||observation.invoiceId&&observation.invoiceId!==inv.id)throw new Error('Invoice correlation failed')
  await lockTransactionKey(tx,`travel-trip:${inv.tripId}`)
  const current=await tx.clientInvoice.findUnique({where:{id:inv.id}})
  if(session.amount!==observation.amount||session.currencyCode!==observation.currencyCode||current.currencyCode!==observation.currencyCode)throw new Error('Payment amount/currency mismatch')
  const key=`stripe:${observation.paymentIntentId}`
  const existing=await tx.payment.findUnique({where:{idempotencyKey:key}})
  if(existing)return {status:'succeeded',invoiceStatus:current.status,paymentId:existing.id,number:current.number}
  if(current.status==='void'||observation.amount>current.totalCents-current.collectedCents)throw new Error('Payment exceeds remaining invoice balance; reconcile')
  const payment=await tx.payment.create({data:{orderId:current.id,paymentCollectionId:session.paymentCollectionId,amount:session.amount,currencyCode:current.currencyCode,status:'succeeded',idempotencyKey:key,providerPaymentId:observation.paymentIntentId,processedAt:new Date()}})
  const collected=current.collectedCents+session.amount, invoiceStatus=collected===current.totalCents?'paid':'partially_paid'
  assertMove('clientInvoice',current.status,invoiceStatus)
  const moved=await tx.clientInvoice.updateMany({where:{id:current.id,status:current.status,collectedCents:current.collectedCents},data:{collectedCents:collected,status:invoiceStatus}})
  if(moved.count!==1)throw new Error('Invoice changed concurrently; retry')
  if(invoiceStatus==='paid')await settleScheduleRows(tx,current.id)
  await tx.paymentSession.update({where:{id:session.id},data:{isSelected:false}})
  await tx.clientFundsEntry.create({data:{tripId:current.tripId,entryType:'receipt',amountCents:session.amount,currencyCode:current.currencyCode,reference:payment.id,occurredAt:new Date(),entryKey:`receipt:${payment.id}`}})
  await tx.auditEvent.create({data:{actorId:context.session?.itemId||null,action:'receive',targetList:'Payment',targetId:payment.id,after:{amountCents:session.amount,providerPaymentId:observation.paymentIntentId}}})
  return {status:'succeeded',invoiceStatus,paymentId:payment.id,number:current.number}
 },{timeout:20000})
}
