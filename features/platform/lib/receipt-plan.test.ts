import test from 'node:test'
import assert from 'node:assert/strict'
import { planReceipt, type OpenComponent } from './receipt-plan'
import { toCents } from './cents'

const row = (id: string, remainingCents: number, currencyCode = 'USD'): OpenComponent => ({ id, title: id, tripTitle: 't', supplierId: 's', supplierName: 'S', currencyCode, remainingCents })

test('receipt total equals the sum of allocations and skips blanks', () => {
  const p = planReceipt([row('a', 5000), row('b', 3000), row('c', 100)], { a: '50', b: '10.25' }, ' ST-1 ', toCents)
  assert.ok(p.ok); if (p.ok) { assert.equal(p.amountCents, 6025); assert.equal(p.reference, 'ST-1'); assert.deepEqual(p.allocations.map((a) => a.componentId), ['a', 'b']); assert.equal(p.overages.length, 0) }
})
test('over-allocation is reported per component and needs a reason', () => {
  const rows = [row('a', 5000), row('b', 3000)]
  assert.equal(planReceipt(rows, { a: '50.01', b: '30' }, 'r', toCents).ok, false)
  const p = planReceipt(rows, { a: '50.01', b: '30' }, 'r', toCents, ' Supplier bonus ')
  assert.ok(p.ok); if (p.ok) { assert.deepEqual(p.overages, [{ componentId: 'a', title: 'a', overCents: 1 }]); assert.equal(p.reason, 'Supplier bonus'); assert.equal(p.amountCents, 8001) }
})
test('a component with nothing outstanding is entirely over-payment', () => {
  const p = planReceipt([row('a', 0)], { a: '12' }, 'r', toCents, 'bonus')
  assert.ok(p.ok); if (p.ok) assert.equal(p.overages[0].overCents, 1200)
})
test('refuses missing reference, no allocation, bad amount and mixed currency', () => {
  assert.equal(planReceipt([row('a', 5000)], { a: '10' }, ' ', toCents).ok, false)
  assert.equal(planReceipt([row('a', 5000)], {}, 'r', toCents).ok, false)
  assert.equal(planReceipt([row('a', 5000)], { a: '1.234' }, 'r', toCents).ok, false)
  assert.equal(planReceipt([row('a', 5000), row('b', 5000, 'EUR')], { a: '1', b: '1' }, 'r', toCents).ok, false)
})
