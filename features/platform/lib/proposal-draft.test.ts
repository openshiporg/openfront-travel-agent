import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProposalPayload } from './proposal-draft'

const item = (over = {}) => ({ title: 'Hotel', kind: 'hotel', sell: '1200.50', commissionPct: '10', ...over })

test('converts to cents and basis points', () => {
  const p = buildProposalPayload(' Hello ', [{ title: 'Classic', items: [item(), item({ title: 'Fee', kind: 'fee', sell: '50', commissionPct: '' })] }])
  assert.ok(p.ok)
  if (p.ok) { assert.equal(p.introNote, 'Hello'); assert.equal(p.options[0].items[0].sellCents, 120050); assert.equal(p.options[0].items[0].estimatedCommissionBps, 1000); assert.equal(p.options[0].items[1].estimatedCommissionBps, 0) }
})
test('refuses empty options, blank titles, bad kind, bad price and bad commission', () => {
  assert.equal(buildProposalPayload('', []).ok, false)
  assert.equal(buildProposalPayload('', [{ title: ' ', items: [item()] }]).ok, false)
  assert.equal(buildProposalPayload('', [{ title: 'A', items: [] }]).ok, false)
  for (const bad of [{ title: '' }, { kind: 'nope' }, { sell: '0' }, { sell: '1.999' }, { commissionPct: '101' }, { commissionPct: '-1' }, { commissionPct: '1.234' }, { commissionPct: 'x' }])
    assert.equal(buildProposalPayload('', [{ title: 'A', items: [item(bad)] }]).ok, false, JSON.stringify(bad))
})
