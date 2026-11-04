export type OpenComponent = { id: string; title: string; tripTitle: string; supplierId: string; supplierName: string; currencyCode: string; remainingCents: number }

type Plan = { ok: true; reference: string; amountCents: number; currencyCode: string; allocations: { componentId: string; amountCents: number }[] } | { ok: false; error: string }

/** Turns per-component dollar inputs into the allocation list the receipt operator needs. Never allocates above outstanding commission. */
export function planReceipt(rows: OpenComponent[], amounts: Record<string, string>, reference: string, toCents: (v: string) => number | null): Plan {
  if (!reference.trim()) return { ok: false, error: 'Reference is required' }
  const allocations: { componentId: string; amountCents: number }[] = []
  for (const row of rows) {
    const raw = (amounts[row.id] || '').trim()
    if (!raw) continue
    const cents = toCents(raw)
    if (cents === null) return { ok: false, error: `${row.title}: enter an amount above zero with at most two decimals` }
    if (cents > row.remainingCents) return { ok: false, error: `${row.title}: more than the outstanding commission; overpayments need manager approval` }
    allocations.push({ componentId: row.id, amountCents: cents })
  }
  if (!allocations.length) return { ok: false, error: 'Allocate the receipt to at least one commission' }
  const currencies = new Set(rows.filter((r) => allocations.some((a) => a.componentId === r.id)).map((r) => r.currencyCode))
  if (currencies.size !== 1) return { ok: false, error: 'A receipt can only cover one currency' }
  return { ok: true, reference: reference.trim(), amountCents: allocations.reduce((n, a) => n + a.amountCents, 0), currencyCode: [...currencies][0], allocations }
}
