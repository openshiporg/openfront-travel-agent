export function planningAmount(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 2147483647) throw new Error('Amount must be non-negative integer cents')
  return value as number
}
export function planningDate(value: unknown): Date | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Valid date required')
  return new Date(value)
}
export function componentTerms(input: any, sellCents: number) {
  const depositCents = planningAmount(input.depositCents)
  const depositDueAt = planningDate(input.depositDueAt), finalDueAt = planningDate(input.finalDueAt)
  if (depositCents > sellCents) throw new Error('Deposit cannot exceed component price')
  if (depositCents > 0 && !depositDueAt) throw new Error('Deposit due date required')
  if (depositDueAt && finalDueAt && depositDueAt > finalDueAt) throw new Error('Final due date must follow deposit')
  return { depositCents, depositDueAt, finalDueAt }
}

/** Called only under the trip lock. Invoiced/paid schedule rows are immutable evidence. */
export async function syncPaymentSchedule(tx: any, t: any) {
  const components = await tx.tripComponent.findMany({ where: { tripId: t.id, paymentModel: 'agency_collects', bookingStatus: { not: 'cancelled' } } })
  const rows: any[] = []
  if (t.planningFeeCents > 0) rows.push({ scheduleKey: `${t.id}:planning_fee`, tripId: t.id, kind: 'planning_fee', amountCents: t.planningFeeCents, dueAt: t.createdAt })
  for (const c of components) {
    if (c.depositCents && c.depositDueAt) rows.push({ scheduleKey: `${c.id}:component_deposit`, tripId: t.id, componentId: c.id, kind: 'component_deposit', amountCents: c.depositCents, dueAt: c.depositDueAt })
    if (c.finalDueAt && c.sellCents > c.depositCents) rows.push({ scheduleKey: `${c.id}:component_final`, tripId: t.id, componentId: c.id, kind: 'component_final', amountCents: c.sellCents - c.depositCents, dueAt: c.finalDueAt })
  }
  const existing = await tx.paymentSchedule.findMany({ where: { tripId: t.id } })
  for (const row of rows) {
    const old = existing.find((s: any) => s.scheduleKey === row.scheduleKey)
    if (old && !['due', 'cancelled'].includes(old.status)) continue
    await tx.paymentSchedule.upsert({ where: { scheduleKey: row.scheduleKey }, update: { amountCents: row.amountCents, dueAt: row.dueAt, status: 'due' }, create: { ...row, currencyCode: t.currencyCode, status: 'due' } })
    const reopen = old?.status === 'cancelled'
    const dueAt = new Date(new Date(row.dueAt).getTime() - 7 * 86400000)
    await tx.task.upsert({ where: { taskKey: `reminder:${row.scheduleKey}` }, update: reopen ? { dueAt, status: 'open', completedAt: null, completionNote: '' } : { dueAt }, create: { taskKey: `reminder:${row.scheduleKey}`, tripId: t.id, assigneeId: t.advisorId, title: row.kind, type: row.kind === 'component_final' ? 'final_due' : 'deposit_due', dueAt, status: 'open' } })
  }
  for (const old of existing.filter((s: any) => s.status === 'due' && !rows.some(r => r.scheduleKey === s.scheduleKey))) {
    await tx.paymentSchedule.update({ where: { id: old.id }, data: { status: 'cancelled' } })
    await tx.task.updateMany({ where: { taskKey: `reminder:${old.scheduleKey}`, status: 'open' }, data: { status: 'cancelled' } })
  }
  return { count: rows.length }
}

/** An invoice line of a scheduled kind and amount claims the earliest matching due row (recorded on the line so payment or voiding can find it). */
export async function matchScheduleRows(tx: any, tripId: string, invoiceId: string, lines: any[]) {
  const lineRows = await tx.clientInvoiceLine.findMany({ where: { invoiceId } })
  for (const l of lineRows) {
    if (!['planning_fee', 'component_deposit', 'component_final'].includes(l.kind)) continue
    const row = await tx.paymentSchedule.findFirst({ where: { tripId, kind: l.kind, amountCents: l.amountCents, status: 'due' }, orderBy: { dueAt: 'asc' } })
    if (!row) continue
    const claimed = await tx.paymentSchedule.updateMany({ where: { id: row.id, status: 'due' }, data: { status: 'invoiced' } })
    if (claimed.count === 1) await tx.clientInvoiceLine.update({ where: { id: l.id }, data: { snapshot: { ...(l.snapshot || {}), scheduleKey: row.scheduleKey } } })
  }
}
const keysOf = async (tx: any, invoiceId: string) => (await tx.clientInvoiceLine.findMany({ where: { invoiceId }, select: { snapshot: true } })).map((l: any) => l.snapshot?.scheduleKey).filter(Boolean)
export async function settleScheduleRows(tx: any, invoiceId: string) {
  const keys = await keysOf(tx, invoiceId); if (!keys.length) return
  await tx.paymentSchedule.updateMany({ where: { scheduleKey: { in: keys }, status: 'invoiced' }, data: { status: 'paid' } })
  await tx.task.updateMany({ where: { taskKey: { in: keys.map((k: string) => `reminder:${k}`) }, status: 'open' }, data: { status: 'completed', completedAt: new Date() } })
}
export async function releaseScheduleRows(tx: any, invoiceId: string) {
  const keys = await keysOf(tx, invoiceId); if (!keys.length) return
  await tx.paymentSchedule.updateMany({ where: { scheduleKey: { in: keys }, status: 'invoiced' }, data: { status: 'due' } })
}
