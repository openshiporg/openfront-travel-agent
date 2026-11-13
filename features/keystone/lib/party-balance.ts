export type PartyInvoice = { id: string; number: string; status: string; totalCents: number; collectedCents: number; dueAt?: string | Date | null; currencyCode: string; partyId?: string | null }
export type PartyBalance = { partyId: string | null; billedCents: number; paidCents: number; balanceCents: number; nextDueAt: string | null; overdue: boolean; currencyCode: string }

const counts = (i: PartyInvoice) => !['draft', 'void', 'refunded'].includes(i.status)
/** Per-party billed / paid / owed from that party's own invoices only. A party never sees any other party's numbers. */
export function partyBalance(invoices: PartyInvoice[], partyId: string | null, now = Date.now()): PartyBalance {
  const mine = invoices.filter((i) => counts(i) && (i.partyId ?? null) === partyId)
  const open = mine.filter((i) => i.status !== 'paid' && i.totalCents > i.collectedCents)
  const due = open.map((i) => (i.dueAt ? new Date(i.dueAt).getTime() : NaN)).filter((n) => !Number.isNaN(n))
  const next = due.length ? Math.min(...due) : null
  return {
    partyId, currencyCode: mine[0]?.currencyCode || 'USD',
    billedCents: mine.reduce((n, i) => n + i.totalCents, 0),
    paidCents: mine.reduce((n, i) => n + Math.min(i.collectedCents, i.totalCents), 0),
    balanceCents: open.reduce((n, i) => n + (i.totalCents - i.collectedCents), 0),
    nextDueAt: next === null ? null : new Date(next).toISOString(),
    overdue: next !== null && Math.floor(next / 86_400_000) < Math.floor(now / 86_400_000),
  }
}
/** Trip-wide view for the advisor: one row per party plus the unassigned (whole-trip) invoices. */
export function allBalances(invoices: PartyInvoice[], partyIds: string[], now = Date.now()): PartyBalance[] {
  const rows = partyIds.map((id) => partyBalance(invoices, id, now))
  const loose = partyBalance(invoices, null, now)
  return loose.billedCents || loose.balanceCents ? [...rows, loose] : rows
}
export type RoomRow = { id: string; label: string; roomType?: string; partyId?: string | null; guestIds: string[] }
/** Problems the advisor should see on a rooming list: guests in two rooms, guests outside the party, empty rooms. */
export function roomingProblems(rooms: RoomRow[], partyTravelers: Record<string, string[]>): string[] {
  const out: string[] = [], seen = new Map<string, string>()
  for (const r of rooms) {
    if (!r.guestIds.length) out.push(`${r.label} has no guests`)
    for (const g of r.guestIds) {
      if (seen.has(g)) out.push(`A guest is in both ${seen.get(g)} and ${r.label}`); else seen.set(g, r.label)
      if (r.partyId && !(partyTravelers[r.partyId] || []).includes(g)) out.push(`${r.label} has a guest outside its party`)
    }
  }
  return out
}
