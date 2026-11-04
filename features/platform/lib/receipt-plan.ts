export type OpenComponent = { id: string; title: string; tripTitle: string; supplierId: string; supplierName: string; currencyCode: string; remainingCents: number }
export type PlannedAllocation = { componentId: string; amountCents: number; overCents: number }

type Plan = { ok: true; reference: string; reason: string; amountCents: number; currencyCode: string; allocations: PlannedAllocation[]; overages: { componentId: string; title: string; overCents: number }[] } | { ok: false; error: string }

/** Turns per-component dollar inputs into allocations. Anything above the outstanding commission is an over-payment that needs a reason and a manager approval. */
export function planReceipt(rows: OpenComponent[], amounts: Record<string, string>, reference: string, toCents: (v: string) => number | null, reason = ''): Plan {
  if (!reference.trim()) return { ok: false, error: 'Reference is required' }
  const allocations: PlannedAllocation[] = []
  for (const row of rows) {
    const raw = (amounts[row.id] || '').trim()
    if (!raw) continue
    const cents = toCents(raw)
    if (cents === null) return { ok: false, error: `${row.title}: enter an amount above zero with at most two decimals` }
    allocations.push({ componentId: row.id, amountCents: cents, overCents: Math.min(cents, Math.max(0, cents - row.remainingCents)) })
  }
  if (!allocations.length) return { ok: false, error: 'Allocate the receipt to at least one commission' }
  const currencies = new Set(rows.filter((r) => allocations.some((a) => a.componentId === r.id)).map((r) => r.currencyCode))
  if (currencies.size !== 1) return { ok: false, error: 'A receipt can only cover one currency' }
  const overages = allocations.filter((a) => a.overCents > 0).map((a) => ({ componentId: a.componentId, title: rows.find((r) => r.id === a.componentId)!.title, overCents: a.overCents }))
  if (overages.length && !reason.trim()) return { ok: false, error: 'Give a reason for the over-payment; a manager must approve it' }
  return { ok: true, reference: reference.trim(), reason: reason.trim(), amountCents: allocations.reduce((n, a) => n + a.amountCents, 0), currencyCode: [...currencies][0], allocations, overages }
}
