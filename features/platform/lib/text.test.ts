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
