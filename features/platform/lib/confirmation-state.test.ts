import test from 'node:test'
import assert from 'node:assert/strict'
import { needsConfirmation, daysUntilStart, startsPhrase } from './confirmation-state'

const now = Date.parse('2026-06-01T12:00:00Z')
const at = (d: number) => new Date(now + d * 86_400_000).toISOString()

test('needs confirmation only with a start date, no number and not cancelled', () => {
  assert.equal(needsConfirmation({ startAt: at(5), confirmationNumber: '' }), true)
  assert.equal(needsConfirmation({ startAt: at(5), confirmationNumber: '  ' }), true)
  assert.equal(needsConfirmation({ startAt: at(5), confirmationNumber: 'HX-1' }), false)
  assert.equal(needsConfirmation({ startAt: null, confirmationNumber: '' }), false)
  assert.equal(needsConfirmation({ startAt: at(5), bookingStatus: 'cancelled' }), false)
})
test('days until start and wording', () => {
  assert.equal(daysUntilStart({ startAt: at(5) }, now), 5)
  assert.equal(daysUntilStart({}, now), null)
  assert.equal(startsPhrase({ startAt: at(5) }, now), 'starts in 5 days')
  assert.equal(startsPhrase({ startAt: at(1) }, now), 'starts tomorrow')
  assert.equal(startsPhrase({ startAt: new Date(now + 3600_000).toISOString() }, now), 'starts today')
  assert.equal(startsPhrase({ startAt: at(-2) }, now), 'already started')
  assert.equal(startsPhrase({}, now), '')
})
