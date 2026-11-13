/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '@keystone-6/core'
// @ts-expect-error internal build, same one Keystone runs: it applies isFilterable/isOrderable per field
import { createSystem } from '../../../node_modules/@keystone-6/core/dist/createSystem-9936a87a.cjs.dev.js'
import { models } from './index'

const sys = createSystem(config({ db: { provider: 'postgresql', url: 'postgres://u:p@localhost:5432/x' }, lists: models as any }))
const role = (r: Record<string, boolean>) => ({ itemId: 'u', data: { role: r } })
const probe = async (listKey: string, fieldKey: string, kind: 'isFilterable' | 'isOrderable', r: Record<string, boolean>) => {
  const rule = sys.lists[listKey].fields[fieldKey].graphql.isEnabled[kind === 'isFilterable' ? 'filter' : 'orderBy']
  if (typeof rule === 'function') return !!(await rule({ context: { session: role(r) }, session: role(r), listKey, fieldKey }))
  return rule
}
describe('filter-path leaks', () => {
  for (const [l, f] of [['Traveler', 'passportExpiresAt'], ['Traveler', 'dateOfBirth'], ['Traveler', 'knownTravelerNumber']])
    for (const r of [{} as Record<string, boolean>, { canManageClients: true, canManageRoles: true }])
      it(`${l}.${f} not filterable/orderable`, async () => {
        assert.equal(await probe(l, f, 'isFilterable', r), false)
        assert.equal(await probe(l, f, 'isOrderable', r), false)
      })
  for (const [l, f, perm] of [['User', 'auditEvents', 'canReadAudit'], ['AuditEvent', 'actor', 'canReadAudit'], ['User', 'commissionLedger', 'canManageCommissions'], ['User', 'requestedRefunds', 'canReadPayments'], ['User', 'processedPayments', 'canManagePayments']])
    it(`${l}.${f} filterable only with ${perm}`, async () => {
      assert.equal(await probe(l, f, 'isFilterable', {}), false)
      assert.equal(await probe(l, f, 'isFilterable', { canManageClients: true, canManageTrips: true }), false)
      assert.equal(await probe(l, f, 'isFilterable', { [perm]: true }), true)
    })
})
