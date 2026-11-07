import test from 'node:test'
import assert from 'node:assert/strict'
import { assertInquiryMove, requiredText, assertClaimable, advisorOwed, assertPayout, componentEntry, tripCancelPlan } from './agency-workflow'

test('inquiry pipeline moves forward, can be lost from any open stage, and lost can reopen', () => {
  assertInquiryMove('new', 'qualifying'); assertInquiryMove('qualifying', 'proposal'); assertInquiryMove('proposal', 'won'); assertInquiryMove('new', 'lost'); assertInquiryMove('lost', 'qualifying'); assertInquiryMove('won', 'lost') // trip cancelled after acceptance
  for (const [a, b] of [['new', 'won'], ['won', 'new'], ['won', 'qualifying'], ['lost', 'won'], ['qualifying', 'new'], ['x', 'new']]) assert.throws(() => assertInquiryMove(a, b), /cannot move/)
})
test('required text trims, collapses spaces and enforces bounds', () => {
  assert.equal(requiredText('  Booked   elsewhere ', 'Reason', 3, 300), 'Booked elsewhere')
  assert.throws(() => requiredText(' ab ', 'Reason', 3, 300), /at least 3/); assert.throws(() => requiredText(undefined, 'Reference', 1, 80), /required/); assert.throws(() => requiredText('x'.repeat(81), 'Reference', 1, 80), /80/)
})
test('commission claims need a confirmed booking with expected, nonzero commission', () => {
  assertClaimable({ bookingStatus: 'booked', commissionStatus: 'expected', commissionCents: 1 })
  assert.throws(() => assertClaimable({ bookingStatus: 'quoted', commissionStatus: 'expected', commissionCents: 100 }), /booked/)
  for (const s of ['invoiced', 'received', 'short_paid', 'written_off']) assert.throws(() => assertClaimable({ bookingStatus: 'ticketed', commissionStatus: s, commissionCents: 100 }), /expected/)
  assert.throws(() => assertClaimable({ bookingStatus: 'booked', commissionStatus: 'expected', commissionCents: 0 }), /no commission/)
})
test('advisor payouts never exceed what is owed and conserve the ledger', () => {
  const ledger = [{ amountCents: 8000 }, { amountCents: 2500 }, { amountCents: -500 }]
  const owed = advisorOwed(ledger); assert.equal(owed, 10000)
  assert.equal(assertPayout(10000, owed), 10000); assert.equal(advisorOwed([...ledger, { amountCents: -10000 }]), 0)
  for (const bad of [0, -1, 10001, 1.5, '100', NaN]) assert.throws(() => assertPayout(bad, owed))
  assert.throws(() => assertPayout(1, 0), /exceeds/); assert.throws(() => advisorOwed([{ amountCents: 0.5 }]))
})
test('reservation entry validates kind, money, commission and dates, storing days at noon UTC', () => {
  const c = componentEntry({ title: ' Return flights ', kind: 'flight', sellCents: 120000, netCostCents: 110000, commissionBps: 500, startAt: '2027-05-01', endAt: '2027-05-10' })
  assert.deepEqual([c.title, c.paymentModel, c.commissionBps, c.startAt?.toISOString(), c.endAt?.toISOString()], ['Return flights', 'client_pays_supplier', 500, '2027-05-01T12:00:00.000Z', '2027-05-10T12:00:00.000Z'])
  assert.equal(componentEntry({ title: 'Fee', kind: 'fee', sellCents: 0 }).startAt, null)
  for (const bad of [{ kind: 'flight', sellCents: 1 }, { title: 'x', kind: 'yacht', sellCents: 1 }, { title: 'x', kind: 'hotel', sellCents: -1 }, { title: 'x', kind: 'hotel', sellCents: 1.5 }, { title: 'x', kind: 'hotel', sellCents: 100, netCostCents: 101 }, { title: 'x', kind: 'hotel', sellCents: 1, commissionBps: 10001 }, { title: 'x', kind: 'hotel', sellCents: 1, commissionBps: 12.5 }, { title: 'x', kind: 'hotel', sellCents: 1, startAt: '2027-05-02', endAt: '2027-05-01' }, { title: 'x', kind: 'hotel', sellCents: 1, startAt: 'soon' }, { title: 'x', kind: 'hotel', sellCents: 1, paymentModel: 'cash' }]) assert.throws(() => componentEntry(bad))
})
test('trip cancellation releases quotes and holds but refuses while booked space remains', () => {
  const p = tripCancelPlan([{ id: 'a', title: 'Hotel', bookingStatus: 'booked' }, { id: 'b', title: 'Tour', bookingStatus: 'held' }, { id: 'c', title: 'Rail', bookingStatus: 'quoted' }, { id: 'd', title: 'Old', bookingStatus: 'cancelled' }, { id: 'e', title: 'Flight', bookingStatus: 'ticketed' }])
  assert.deepEqual(p, { blockers: ['Hotel', 'Flight'], release: ['b', 'c'] })
  assert.deepEqual(tripCancelPlan([]), { blockers: [], release: [] })
})
