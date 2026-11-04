import test from 'node:test'
import assert from 'node:assert/strict'
import { supplierDue, penaltyStartsAt } from './supplier-due'

const now = Date.parse('2026-06-10T12:00:00Z')
const iso = (d: number) => new Date(now + d * 86_400_000).toISOString()
const base = { paymentModel: 'agency_collects', bookingStatus: 'booked', netCostCents: 80000, supplierPayments: [] as { amountCents: number }[] }

test('an explicit date wins and flags overdue with whole days late', () => {
  const r = supplierDue({ ...base, supplierDueAt: iso(-3) }, now)
  assert.deepEqual([r.source, r.overdue, r.daysLate, r.remainingCents], ['set', true, 3, 80000])
  assert.equal(supplierDue({ ...base, supplierDueAt: iso(4) }, now).overdue, false)
})
test('without a date, the first cancellation penalty start is the deadline', () => {
  const schedule = [{ daysBefore: 60, penaltyBps: 2500 }, { daysBefore: 14, penaltyBps: 10000 }]
  const startAt = iso(50)
  assert.equal(penaltyStartsAt(startAt, schedule), iso(-10))
  const r = supplierDue({ ...base, startAt, cancelPenaltySchedule: schedule }, now)
  assert.deepEqual([r.source, r.overdue, r.daysLate], ['cancellation', true, 10])
  assert.equal(supplierDue({ ...base, startAt: iso(90), cancelPenaltySchedule: schedule }, now).overdue, false)
})
test('due today is not late; yesterday is one day late, whatever the time of day', () => {
  const noonToday = '2026-06-10T12:00:00Z'
  assert.equal(supplierDue({ ...base, supplierDueAt: noonToday }, Date.parse('2026-06-10T23:59:00Z')).overdue, false)
  const r = supplierDue({ ...base, supplierDueAt: '2026-06-09T12:00:00Z' }, Date.parse('2026-06-10T00:30:00Z'))
  assert.deepEqual([r.overdue, r.daysLate], [true, 1])
})
test('part payments reduce what is owed and full payment clears it', () => {
  assert.equal(supplierDue({ ...base, supplierDueAt: iso(-1), supplierPayments: [{ amountCents: 30000 }] }, now).remainingCents, 50000)
  const paid = supplierDue({ ...base, supplierDueAt: iso(-1), supplierPayments: [{ amountCents: 50000 }, { amountCents: 30000 }] }, now)
  assert.deepEqual([paid.remainingCents, paid.overdue, paid.dueAt], [0, false, null])
})
test('no obligation when the client pays the supplier, or the booking is unconfirmed or cancelled', () => {
  for (const patch of [{ paymentModel: 'client_pays_supplier' }, { bookingStatus: 'quoted' }, { bookingStatus: 'held' }, { bookingStatus: 'cancelled' }, { netCostCents: 0 }])
    assert.equal(supplierDue({ ...base, supplierDueAt: iso(-5), ...patch }, now).overdue, false, JSON.stringify(patch))
})
test('owed but no deadline known: remaining shown, never overdue', () => {
  const r = supplierDue(base, now)
  assert.deepEqual([r.remainingCents, r.dueAt, r.overdue], [80000, null, false])
  assert.equal(penaltyStartsAt(iso(10), []), null)
  assert.equal(penaltyStartsAt(null, [{ daysBefore: 5 }]), null)
  assert.equal(penaltyStartsAt(iso(10), 'junk'), null)
})
