import test from 'node:test'
import assert from 'node:assert/strict'
import { toCents } from './cents'

test('parses dollars to exact integer cents', () => {
  assert.equal(toCents('10'), 1000)
  assert.equal(toCents('10.5'), 1050)
  assert.equal(toCents('0.29'), 29)
  assert.equal(toCents('1.15'), 115)
})
test('rejects zero, negatives, blanks, extra decimals and text', () => {
  for (const v of ['0', '0.00', '-5', '', ' ', '1.234', '1,000', 'abc', '1e3']) assert.equal(toCents(v), null)
})
