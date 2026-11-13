import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MACHINES,canTransition,assertMove,terminalStates,type MachineName} from './stateMachines';
import {tripTransitions} from './travel-money';
import {inquiryMoves} from './agency-workflow';
const model=(file:string)=>readFileSync(new URL(`../models/${file}.ts`,import.meta.url),'utf8');
const declared=(file:string,field:string)=>{const m=new RegExp(`${field}: state\\(\\[([^\\]]*)\\]`).exec(model(file));return m?[...m[1].matchAll(/"([a-z_]+)"/g)].map(x=>x[1]):[];};
const selectValues=(file:string)=>{const src=model(file);const i=src.indexOf('status: select');const j=src.indexOf(']',i);return [...src.slice(i,j).matchAll(/value: "([a-z_]+)"/g)].map(x=>x[1]);};
test('every machine covers exactly the statuses declared on its model',()=>{
 const pairs:[MachineName,string[]][]=[['trip',declared('Trip','status')],['proposal',declared('Proposal','status')],['clientInvoice',declared('ClientInvoice','status')],['paymentSchedule',declared('PaymentSchedule','status')],['componentBooking',declared('TripComponent','bookingStatus')],['commission',declared('TripComponent','commissionStatus')],['inquiry',declared('Inquiry','status')],['task',declared('Task','status')],['payment',selectValues('Payment')],['refund',selectValues('Refund')],['managerApproval',selectValues('ManagerApproval')],['paymentWebhookEvent',selectValues('PaymentWebhookEvent').concat('failed')]];
 for(const [name,states] of pairs){assert.ok(states.length,`${name}: no statuses parsed`);const keys=Object.keys(MACHINES[name]);for(const s of states)assert.ok(keys.includes(s),`${name}: ${s} missing`);for(const k of keys)assert.ok(states.includes(k),`${name}: ${k} not on model`);}
});
test('the shared maps agree',()=>{assert.deepEqual(MACHINES.trip,tripTransitions);assert.deepEqual(MACHINES.inquiry,inquiryMoves);});
test('illegal moves found in the audit are refused',()=>{
 assert.equal(canTransition('clientInvoice','paid','void'),false);
 assert.equal(canTransition('clientInvoice','paid','refunded'),true);
 assert.equal(canTransition('clientInvoice','refunded','paid'),false);
 assert.equal(canTransition('clientInvoice','partially_paid','void'),false);
 assert.equal(canTransition('componentBooking','cancelled','booked'),false);
 assert.equal(canTransition('proposal','accepted','superseded'),false);
 assert.equal(canTransition('commission','received','invoiced'),false);
 assert.throws(()=>assertMove('trip','completed','traveling'));
 assert.deepEqual(terminalStates('refund').sort(),['failed','succeeded']);
});
test('every target is a known state',()=>{for(const [n,m] of Object.entries(MACHINES))for(const [from,to] of Object.entries(m))for(const t of to)assert.ok(t in m,`${n}: ${from} -> ${t}`);});
