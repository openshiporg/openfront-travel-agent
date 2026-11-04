import test from 'node:test'
import assert from 'node:assert/strict'
import { isOverdue, daysOverdue, taskStatus } from './task-state'

const now = Date.parse('2026-11-03T12:00:00.000Z')

test('only open tasks past their due moment are overdue', () => {
  assert.equal(isOverdue({ status: 'open', dueAt: '2026-11-03T11:59:59.000Z' }, now), true)
  assert.equal(isOverdue({ status: 'open', dueAt: '2026-11-03T12:00:00.000Z' }, now), false)
  assert.equal(isOverdue({ status: 'open', dueAt: '2026-11-10T00:00:00.000Z' }, now), false)
  assert.equal(isOverdue({ status: 'completed', dueAt: '2026-01-01T00:00:00.000Z' }, now), false)
  assert.equal(isOverdue({ status: 'cancelled', dueAt: '2026-01-01T00:00:00.000Z' }, now), false)
})
test('missing or unparsable due dates are never overdue', () => {
  assert.equal(isOverdue({ status: 'open' }, now), false)
  assert.equal(isOverdue({ status: 'open', dueAt: null }, now), false)
  assert.equal(isOverdue({ status: 'open', dueAt: 'nonsense' }, now), false)
})
test('days overdue counts whole days with a floor of one', () => {
  assert.equal(daysOverdue({ status: 'open', dueAt: '2026-11-03T11:00:00.000Z' }, now), 1)
  assert.equal(daysOverdue({ status: 'open', dueAt: '2026-10-30T12:00:00.000Z' }, now), 4)
  assert.equal(daysOverdue({ status: 'completed', dueAt: '2026-10-30T12:00:00.000Z' }, now), 0)
})
test('status label switches to overdue and keeps others', () => {
  assert.equal(taskStatus({ status: 'open', dueAt: '2026-10-01T00:00:00.000Z' }, now), 'overdue')
  assert.equal(taskStatus({ status: 'completed', dueAt: '2026-10-01T00:00:00.000Z' }, now), 'completed')
  assert.equal(taskStatus({ status: 'open', dueAt: null }, now), 'open')
})
