import test from 'node:test'
import assert from 'node:assert/strict'
import { componentTerms, planningAmount, planningDate } from './trip-planning'
test('nonnegative integer money including zero', () => { assert.equal(planningAmount(0), 0); for (const v of [-1, 1.5, '5', NaN, 2147483648]) assert.throws(() => planningAmount(v)) })
test('component dates and deposit boundaries', () => {
  assert.equal(componentTerms({depositCents:100,depositDueAt:'2026-11-01',finalDueAt:'2026-11-02'},100).depositCents,100)
  assert.throws(()=>componentTerms({depositCents:101,depositDueAt:'2026-11-01',finalDueAt:null},100),/exceed/)
  assert.throws(()=>componentTerms({depositCents:10,depositDueAt:null,finalDueAt:null},100),/required/)
  assert.throws(()=>componentTerms({depositCents:10,depositDueAt:'2026-11-03',finalDueAt:'2026-11-02'},100),/follow/)
  assert.throws(()=>planningDate('no date'))
})
