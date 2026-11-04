import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProposalPayload, depositBpsFromPercent, draftFromProposal } from './proposal-draft'

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

test('editing a saved proposal round-trips exactly and keeps supplier and details', () => {
  const saved = { options: [{ title: 'Classic', items: [{ title: 'Hotel', kind: 'hotel', sellCents: 120050, estimatedCommissionBps: 1250, supplierId: 'sup1', details: 'Sea view' }, { title: 'Fee', kind: 'fee', sellCents: 5000, estimatedCommissionBps: 0 }] }] }
  const draft = draftFromProposal(saved)
  assert.equal(draft[0].items[0].sell, '1200.50'); assert.equal(draft[0].items[0].commissionPct, '12.5'); assert.equal(draft[0].items[1].commissionPct, '')
  const p = buildProposalPayload('', draft)
  assert.ok(p.ok); if (p.ok) { assert.deepEqual(p.options[0].items[0], { title: 'Hotel', kind: 'hotel', sellCents: 120050, estimatedCommissionBps: 1250, supplierId: 'sup1', details: 'Sea view' }); assert.equal(p.options[0].items[1].sellCents, 5000); assert.equal('supplierId' in p.options[0].items[1], false) }
})

test('deposit percent converts to basis points', () => {
  assert.equal(depositBpsFromPercent(''), 0)
  assert.equal(depositBpsFromPercent('25'), 2500)
  assert.equal(depositBpsFromPercent('12.5'), 1250)
  assert.equal(depositBpsFromPercent('100'), 10000)
  for (const bad of ['101', '-1', '1.234', 'abc', '10%']) assert.equal(depositBpsFromPercent(bad), null, bad)
})
