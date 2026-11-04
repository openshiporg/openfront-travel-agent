import test from 'node:test'
import assert from 'node:assert/strict'
import { passportStatus, parsePassportExpiry } from './passport-check'

const now = new Date('2026-11-04T12:00:00Z')
const trip = { startDate: '2027-03-01T12:00:00Z', endDate: '2027-03-10T12:00:00Z' }
test('statuses against the return date and the six month rule', () => {
  assert.equal(passportStatus(null, trip, now), 'missing')
  assert.equal(passportStatus('2026-10-01T12:00:00Z', trip, now), 'expired')
  assert.equal(passportStatus('2027-02-01T12:00:00Z', trip, now), 'expires_before_return')
  assert.equal(passportStatus('2027-06-10T12:00:00Z', trip, now), 'short_validity')
  assert.equal(passportStatus('2027-09-10T12:00:00Z', trip, now), 'valid')
  assert.equal(passportStatus('2027-09-09T12:00:00Z', trip, now), 'short_validity', 'one day short of six months')
})
test('return falls back to departure, then to today', () => {
  assert.equal(passportStatus('2027-02-01T12:00:00Z', { startDate: '2027-03-01T12:00:00Z' }, now), 'expires_before_return')
  assert.equal(passportStatus('2027-06-01T12:00:00Z', {}, now), 'valid')
  assert.equal(passportStatus('2027-01-01T12:00:00Z', {}, now), 'short_validity')
  assert.equal(passportStatus('garbage', trip, now), 'missing')
})
test('expiry input must be a real calendar day in range', () => {
  assert.equal(parsePassportExpiry('2030-05-17', now).toISOString(), '2030-05-17T12:00:00.000Z')
  for (const bad of ['', 'tomorrow', '2030-02-30', '2030-13-01', '17/05/2030', '1980-01-01', '2099-01-01', null]) assert.throws(() => parsePassportExpiry(bad, now), /Passport expiry/, String(bad))
})
