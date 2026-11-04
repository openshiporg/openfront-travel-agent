import test from 'node:test'
import assert from 'node:assert/strict'
import { planReceipt, type OpenComponent } from './receipt-plan'
import { toCents } from './cents'

const row = (id: string, remainingCents: number, currencyCode = 'USD'): OpenComponent => ({ id, title: id, tripTitle: 't', supplierId: 's', supplierName: 'S', currencyCode, remainingCents })

test('receipt total equals the sum of allocations and skips blanks', () => {
  const p = planReceipt([row('a', 5000), row('b', 3000), row('c', 100)], { a: '50', b: '10.25' }, ' ST-1 ', toCents)
  assert.ok(p.ok); if (p.ok) { assert.equal(p.amountCents, 6025); assert.equal(p.reference, 'ST-1'); assert.deepEqual(p.allocations.map((a) => a.componentId), ['a', 'b']) }
})
test('refuses missing reference, no allocation, bad amount, over-allocation and mixed currency', () => {
  assert.equal(planReceipt([row('a', 5000)], { a: '10' }, ' ', toCents).ok, false)
  assert.equal(planReceipt([row('a', 5000)], {}, 'r', toCents).ok, false)
  assert.equal(planReceipt([row('a', 5000)], { a: '1.234' }, 'r', toCents).ok, false)
  const over = planReceipt([row('a', 5000)], { a: '50.01' }, 'r', toCents); assert.equal(over.ok, false)
  assert.equal(planReceipt([row('a', 5000), row('b', 5000, 'EUR')], { a: '1', b: '1' }, 'r', toCents).ok, false)
})
