import test from 'node:test'
import assert from 'node:assert/strict'
import { dayShift, shiftDate } from './trip-copy'

test('shift counts whole UTC days regardless of time of day', () => {
  assert.equal(dayShift(new Date('2026-05-01T12:00:00Z'), new Date('2027-05-01T00:00:00Z')), 365)
  assert.equal(dayShift(new Date('2026-05-10T23:59:00Z'), new Date('2026-05-01T00:01:00Z')), -9)
  assert.equal(dayShift(new Date('2026-03-01T00:00:00Z'), new Date('2026-03-01T23:00:00Z')), 0)
})
test('unknown dates mean no shift', () => {
  assert.equal(dayShift(null, new Date()), 0)
  assert.equal(dayShift(new Date(), undefined), 0)
  assert.equal(shiftDate(null, 5), null)
})
test('shifting keeps the time of day (itinerary days stay at noon UTC)', () => {
  assert.equal(shiftDate(new Date('2026-05-01T12:00:00Z'), 31)!.toISOString(), '2026-06-01T12:00:00.000Z')
})
