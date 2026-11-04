import test from 'node:test'
import assert from 'node:assert/strict'
import { currentInsurance, insuranceGaps, parseWaiverNote, parseDecision, insuranceNeedsAction } from './insurance-offer'

const r = (travelerId: string, decision: string, at: string, waiverNote?: string) => ({ travelerId, decision, recordedAt: at, waiverNote })
test('latest answer wins; no record means not offered', () => {
  const recs = [r('a', 'offered', '2026-11-01T10:00:00Z'), r('a', 'declined', '2026-11-02T10:00:00Z', 'Has annual cover'), r('a', 'accepted', '2026-11-03T10:00:00Z'), r('b', 'offered', '2026-11-01T10:00:00Z')]
  assert.equal(currentInsurance(recs, 'a').status, 'accepted')
  assert.equal(currentInsurance(recs, 'a').waiverNote, null, 'a waiver note only shows while the answer is declined')
  assert.equal(currentInsurance(recs, 'b').status, 'offered')
  assert.deepEqual(currentInsurance(recs, 'zz'), { status: 'not_offered', recordedAt: null, waiverNote: null })
})
test('declined carries its note and timestamp', () => {
  const c = currentInsurance([r('a', 'declined', '2026-11-02T10:00:00Z', 'Has annual cover')], 'a')
  assert.deepEqual([c.status, c.waiverNote, c.recordedAt], ['declined', 'Has annual cover', '2026-11-02T10:00:00.000Z'])
})
test('gaps list travelers with no answer or only an offer', () => {
  const g = insuranceGaps([r('a', 'accepted', '2026-11-01T10:00:00Z'), r('b', 'offered', '2026-11-01T10:00:00Z'), r('c', 'declined', '2026-11-01T10:00:00Z', 'x'.repeat(12))], ['a', 'b', 'c', 'd'])
  assert.deepEqual(g.open.map((x) => x.id), ['b', 'd']); assert.deepEqual(g.declined.map((x) => x.id), ['c'])
  assert.equal(insuranceNeedsAction('accepted'), false); assert.equal(insuranceNeedsAction('declined'), false)
})
test('waiver note and decision validation', () => {
  assert.equal(parseWaiverNote('  Has   annual\ncover  '), 'Has annual cover')
  assert.throws(() => parseWaiverNote('no'), /at least 10/); assert.throws(() => parseWaiverNote(''), /at least 10/); assert.throws(() => parseWaiverNote('x'.repeat(501)), /500/)
  assert.equal(parseDecision('accepted'), 'accepted'); assert.throws(() => parseDecision('maybe'), /Choose/)
})
