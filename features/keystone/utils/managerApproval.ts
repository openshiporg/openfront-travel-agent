import {permissions} from '../access';
import {canonicalIdempotencyParams,idempotencyFingerprint} from './idempotency';

export type ApprovalAction='refund_payment'|'commission_overpayment'|'commission_writeoff';
export type ApprovalRequest={actionType:ApprovalAction;targetId:string;reason:string;amountCents?:number|null};
const ACTIONS:ApprovalAction[]=['refund_payment','commission_overpayment','commission_writeoff'];
const APPROVAL_TTL_MS=60*60*1000;

function normalized(input:ApprovalRequest){
  return canonicalIdempotencyParams({actionType:input.actionType,targetId:input.targetId,reason:input.reason.trim(),amountCents:input.amountCents??null});
}
function canRequest(context:any,action:ApprovalAction){
  const s={session:context.session};
  return action==='refund_payment'?permissions.canIssueRefunds(s):permissions.canManageCommissions(s);
}
export async function requestManagerApproval(_root:any,input:ApprovalRequest,context:any){
  const requesterId=context.session?.itemId;
  if(!requesterId||!ACTIONS.includes(input.actionType)||!canRequest(context,input.actionType))throw new Error('Not authorized to request this approval');
  if(!input.targetId?.trim())throw new Error('Approval target is required');
  if(!input.reason?.trim())throw new Error('Approval reason is required');
  if(input.amountCents!=null&&(!Number.isSafeInteger(input.amountCents)||input.amountCents<0))throw new Error('Invalid amount');
  const payload=normalized(input);
  const row=await context.prisma.managerApproval.create({data:{actionType:input.actionType,targetId:input.targetId.trim(),amountCents:input.amountCents??null,reason:input.reason.trim(),requestPayload:payload,requestFingerprint:idempotencyFingerprint(payload),status:'requested',requestedById:requesterId,expiresAt:new Date(Date.now()+APPROVAL_TTL_MS)}});
  return {id:row.id,status:row.status};
}
/** Approve or reject: only a different user holding settings authority may decide, once. */
export async function decideManagerApproval(_root:any,{approvalId,decision}:{approvalId:string;decision:string},context:any){
  const approverId=context.session?.itemId;
  if(!approverId||!permissions.canManageSettings({session:context.session}))throw new Error('Not authorized to decide approvals');
  if(!['approved','rejected'].includes(decision))throw new Error('Invalid decision');
  return context.prisma.$transaction(async(tx:any)=>{
    const a=await tx.managerApproval.findUnique({where:{id:approvalId}});
    if(!a)throw new Error('Approval not found');
    if(a.requestedById===approverId)throw new Error('The requester cannot decide their own approval');
    if(a.status!=='requested')throw new Error(`Approval is already ${a.status}`);
    if(new Date(a.expiresAt)<=new Date())throw new Error('Approval has expired');
    const r=await tx.managerApproval.updateMany({where:{id:a.id,status:'requested',requestedById:{not:approverId}},data:{status:decision,approvedById:approverId,decidedAt:new Date()}});
    if(r.count!==1)throw new Error('Approval changed concurrently');
    return {id:a.id,status:decision};
  },{isolationLevel:'Serializable'});
}
/** Single use: binds to the exact action/target/amount/reason and to the requester, and flips to consumed in the caller's transaction. */
export async function consumeManagerApproval(tx:any,input:ApprovalRequest&{approvalId?:string|null;actorId?:string|null;entityType:string;entityId:string}){
  if(!input.approvalId)throw new Error('Independent manager approval is required');
  if(!input.actorId)throw new Error('Authenticated actor is required');
  const a=await tx.managerApproval.findUnique({where:{id:input.approvalId}});
  if(!a)throw new Error('Approval not found');
  const fp=idempotencyFingerprint(normalized(input));
  if(a.requestFingerprint!==idempotencyFingerprint(a.requestPayload||{})||a.requestFingerprint!==fp||a.requestedById!==input.actorId)throw new Error('Approval does not match this request');
  if(!a.approvedById||a.approvedById===input.actorId)throw new Error('Approval must come from a different user');
  if(a.status!=='approved')throw new Error(`Approval is ${a.status}`);
  if(new Date(a.expiresAt)<=new Date())throw new Error('Approval has expired');
  const r=await tx.managerApproval.updateMany({where:{id:a.id,status:'approved',requestedById:input.actorId,approvedById:{not:input.actorId},expiresAt:{gt:new Date()}},data:{status:'consumed',consumedAt:new Date(),consumedEntityType:input.entityType,consumedEntityId:input.entityId}});
  if(r.count!==1)throw new Error('Approval was already used or has expired');
  return a;
}
