import test from 'node:test'
import assert from 'node:assert/strict'
import { partyBalance, allBalances, roomingProblems } from './party-balance'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const inv = (o: any) => ({ id: 'i', number: 'N', status: 'sent', totalCents: 10000, collectedCents: 0, dueAt: '2026-12-01T12:00:00Z', currencyCode: 'USD', partyId: 'A', ...o })
test('each party sees only its own invoices', () => {
  const all = [inv({ id: '1', partyId: 'A', totalCents: 30000, collectedCents: 10000 }), inv({ id: '2', partyId: 'B', totalCents: 99900 }), inv({ id: '3', partyId: null, totalCents: 5000 })]
  const a = partyBalance(all, 'A', NOW), b = partyBalance(all, 'B', NOW)
  assert.deepEqual([a.billedCents, a.paidCents, a.balanceCents], [30000, 10000, 20000])
  assert.deepEqual([b.billedCents, b.balanceCents], [99900, 99900])
  assert.equal(partyBalance(all, 'C', NOW).billedCents, 0)
})
test('draft and void never count; paid has no balance; overdue is by calendar day', () => {
  const all = [inv({ id: '1', status: 'void' }), inv({ id: '2', status: 'draft' }), inv({ id: '3', status: 'paid', collectedCents: 10000 }), inv({ id: '4', dueAt: '2026-11-09T12:00:00Z' }), inv({ id: '5', dueAt: '2026-11-10T01:00:00Z' })]
  const r = partyBalance(all, 'A', NOW)
  assert.deepEqual([r.billedCents, r.balanceCents, r.overdue, r.nextDueAt], [30000, 20000, true, '2026-11-09T12:00:00.000Z'])
  assert.equal(partyBalance([inv({ dueAt: '2026-11-10T01:00:00Z' })], 'A', NOW).overdue, false, 'due today is not late')
})
test('trip view has a row per party and a whole-trip row only when needed', () => {
  assert.equal(allBalances([inv({ partyId: 'A' })], ['A', 'B'], NOW).length, 2)
  assert.equal(allBalances([inv({ partyId: 'A' }), inv({ partyId: null })], ['A', 'B'], NOW).length, 3)
})
test('rooming list problems', () => {
  const rooms = [{ id: '1', label: 'Room 1', partyId: 'A', guestIds: ['t1', 't2'] }, { id: '2', label: 'Room 2', partyId: 'A', guestIds: ['t2', 't9'] }, { id: '3', label: 'Room 3', guestIds: [] }]
  const p = roomingProblems(rooms, { A: ['t1', 't2'] })
  assert.deepEqual(p, ['A guest is in both Room 1 and Room 2', 'Room 2 has a guest outside its party', 'Room 3 has no guests'])
  assert.deepEqual(roomingProblems([{ id: '1', label: 'R', partyId: 'A', guestIds: ['t1'] }], { A: ['t1'] }), [])
})
