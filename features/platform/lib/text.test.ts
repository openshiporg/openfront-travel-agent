import test from 'node:test'
import assert from 'node:assert/strict'
import { joinParts, dateRange } from './text'

test('joinParts omits missing parts and never prints undefined', () => {
  assert.equal(joinParts(['TR-1', undefined, '', null, '  ', 'Dmitri']), 'TR-1 · Dmitri')
  assert.equal(joinParts([undefined, null]), '')
  assert.equal(joinParts(['a', 'undefined', 'b']), 'a · b')
})
test('dateRange handles both, one or no dates', () => {
  assert.match(dateRange('2027-04-22T12:00:00Z', '2027-05-06T12:00:00Z'), /^Apr 22, 2027 to May 6, 2027$/)
  assert.match(dateRange('2027-04-22T12:00:00Z', null), /^From Apr 22, 2027$/)
  assert.match(dateRange(null, '2027-05-06T12:00:00Z'), /^Until May 6, 2027$/)
  assert.equal(dateRange(null, undefined), '')
})

test('dates format in UTC so the server and browser time zones never change the day', () => {
  assert.equal(dateRange('2027-04-02T23:30:00.000Z', null), 'From Apr 2, 2027')
  assert.equal(dateRange('2027-04-03T00:30:00.000Z', '2027-04-12T12:00:00.000Z'), 'Apr 3, 2027 to Apr 12, 2027')
})
