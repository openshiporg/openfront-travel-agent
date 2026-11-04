import test from 'node:test'
import assert from 'node:assert/strict'
import {settleInvoicePayment} from './invoice-settlement'

function fixture(overrides:any={}){
 const rows:any={payment:null,receipt:null,audit:null,invoice:{id:'invoice',tripId:'trip',currencyCode:'USD',totalCents:1000,collectedCents:0,status:'sent',number:'INV-1',...overrides}}
 const tx:any={
  $queryRaw:async()=>[],paymentSession:{findFirst:async()=>({id:'session',amount:1000,currencyCode:'USD',paymentCollectionId:'collection'}),update:async()=>({})},
  clientInvoice:{findFirst:async()=>rows.invoice,findUnique:async()=>rows.invoice,update:async({data}:any)=>Object.assign(rows.invoice,data)},
  payment:{findUnique:async()=>rows.payment,create:async({data}:any)=>(rows.payment={id:'payment',...data})},
  clientFundsEntry:{create:async({data}:any)=>(rows.receipt=data)},auditEvent:{create:async({data}:any)=>(rows.audit=data)}
 }
 const context={prisma:{$transaction:async(fn:any)=>fn(tx)}}
 return {context,rows,tx}
}
const observation={paymentIntentId:'pi_test',amount:1000,currencyCode:'USD',invoiceId:'invoice'}
test('verified settlement creates payment, invoice, receipt and audit; replay posts nothing twice',async()=>{
 const f=fixture();assert.equal((await settleInvoicePayment(f.context,observation)).invoiceStatus,'paid');assert.equal(f.rows.receipt.amountCents,1000);assert.equal(f.rows.audit.action,'receive');const receipt=f.rows.receipt
 await settleInvoicePayment(f.context,observation);assert.equal(f.rows.receipt,receipt);assert.equal(f.rows.invoice.collectedCents,1000)
})
test('wrong amount, currency, invoice and overcollection fail closed',async()=>{
 for(const patch of [{amount:999},{currencyCode:'EUR'},{invoiceId:'foreign'}])await assert.rejects(()=>settleInvoicePayment(fixture().context,{...observation,...patch}))
 await assert.rejects(()=>settleInvoicePayment(fixture({collectedCents:500}).context,observation),/remaining/)
 await assert.rejects(()=>settleInvoicePayment(fixture({status:'void'}).context,observation),/remaining/)
})
