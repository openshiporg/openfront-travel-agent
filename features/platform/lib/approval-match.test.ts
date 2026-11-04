import test from 'node:test'
import assert from 'node:assert/strict'
import { matchingApproval, type ApprovalCandidate } from './approval-match'
const now = Date.now()
const row: ApprovalCandidate = { id: 'approval', actionType: 'refund_payment', targetId: 'pay', amountCents: 60000, reason: 'Travel cancelled', status: 'approved', expiresAt: new Date(now + 60000).toISOString(), requestedBy: { id: 'advisor' }, approvedBy: { id: 'manager' } }
const input = { actionType: 'refund_payment', targetId: 'pay', amountCents: 60000, reason: ' Travel cancelled ', actorId: 'advisor' }
test('discovers exact approved refund after amount entry', () => assert.equal(matchingApproval([row], input, now), 'approval'))
test('rejects wrong amount, reason, target, actor, action, expired, consumed and self approval', () => {
  for (const patch of [{ amountCents: 60001 }, { reason: 'Other' }, { targetId: 'other' }, { actionType: 'commission_writeoff' }, { status: 'consumed' }, { requestedBy: { id: 'other' } }, { approvedBy: { id: 'advisor' } }, { approvedBy: null }, { expiresAt: new Date(now).toISOString() }]) assert.equal(matchingApproval([{ ...row, ...patch }], input, now), null)
})
