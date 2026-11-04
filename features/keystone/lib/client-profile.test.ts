import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProfile, readProfile, applyLoyalty, loyaltyPrograms, profileIsEmpty } from './client-profile'

test('profile fields are trimmed, collapsed and length checked', () => {
  const p = parseProfile({ seat: '  Aisle,   forward ', room: 'Quiet', dietary: 'Vegetarian', celebrations: [{ label: ' Anniversary ', date: '2027-03-04' }, { label: 'Birthday' }] })
  assert.deepEqual([p.seat, p.celebrations[0].label, p.celebrations[1].date], ['Aisle, forward', 'Anniversary', null])
  assert.throws(() => parseProfile({ dietary: 'x'.repeat(201) }), /Dietary is too long/)
  assert.throws(() => parseProfile({ celebrations: [{ label: '' }] }), /label/)
  assert.throws(() => parseProfile({ celebrations: [{ label: 'x', date: '2027-02-30' }] }), /real date/)
  assert.throws(() => parseProfile({ celebrations: Array.from({ length: 11 }, () => ({ label: 'x' })) }), /At most 10/)
})
test('stored junk reads back as an empty profile, never throws', () => {
  for (const junk of [null, 'x', 5, [], { celebrations: 'no' }, { seat: 'x'.repeat(500) }]) assert.ok(profileIsEmpty(readProfile(junk)) || readProfile(junk).celebrations.length === 0)
  assert.equal(readProfile({ seat: 'Aisle' }).seat, 'Aisle')
})
test('loyalty: add, update, remove and validation, result never carries the number', () => {
  let r = applyLoyalty(null, ' Skyline ', 'SK 12345'); assert.deepEqual([r.action, r.map.Skyline], ['added', 'SK 12345'])
  r = applyLoyalty(r.map, 'Skyline', 'SK-99999'); assert.equal(r.action, 'updated')
  r = applyLoyalty({ ...r.map, Other: 'ZZ111' }, 'Skyline', ''); assert.deepEqual([r.action, Object.keys(r.map)], ['removed', ['Other']])
  assert.ok(!JSON.stringify({ program: r.program, action: r.action }).includes('SK'))
  for (const bad of ['a', '=1+1', 'x'.repeat(31), 'ab;cd']) assert.throws(() => applyLoyalty({}, 'P', bad), /Loyalty number/)
  assert.throws(() => applyLoyalty({}, '', '12345'), /program/)
  assert.deepEqual(loyaltyPrograms({ b: '1', a: '2' }), ['a', 'b'])
  assert.deepEqual(loyaltyPrograms(null), [])
})
