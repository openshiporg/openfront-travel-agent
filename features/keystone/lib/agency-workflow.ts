/** Pure rules for the agency's daily workflows: lead pipeline, commission claims, advisor payouts, reservation entry and trip cancellation. */

export const inquiryMoves: Record<string, string[]> = {
  new: ['qualifying', 'lost'],
  qualifying: ['proposal', 'lost'],
  proposal: ['won', 'lost'],
  won: [],
  lost: ['qualifying'],
}
export function assertInquiryMove(current: string, next: string) {
  if (!inquiryMoves[current]?.includes(next)) throw new Error(`An inquiry cannot move from ${current.replace(/_/g, ' ')} to ${next.replace(/_/g, ' ')}`)
}
/** A trip counts as won business once the client has accepted. */
export const WON_TRIP_STATUSES = ['accepted', 'booked', 'final_payment_due', 'paid_in_full', 'traveling', 'completed']

export function requiredText(value: unknown, label: string, min: number, max: number) {
  const v = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (v.length < min) throw new Error(min > 1 ? `${label} required (at least ${min} characters)` : `${label} required`)
  if (v.length > max) throw new Error(`${label} must be ${max} characters or fewer`)
  return v
}

/** Commission can be claimed from the supplier once the booking is confirmed and nothing has been received yet. */
export function assertClaimable(c: { bookingStatus: string; commissionStatus: string; commissionCents: number }) {
  if (!['booked', 'ticketed'].includes(c.bookingStatus)) throw new Error('Only booked components can have commission claimed')
  if (c.commissionStatus !== 'expected') throw new Error('Only expected commission can be claimed')
  if (!(c.commissionCents > 0)) throw new Error('This component has no commission to claim')
}
/** Statuses that still wait for supplier money (receipt allocation and write-off apply to all of them). */
export const OPEN_COMMISSION = ['expected', 'invoiced', 'short_paid']

/** What the agency owes an advisor: allocations and reversals add, payouts (stored negative) subtract. */
export function advisorOwed(entries: { amountCents: number }[]) {
  return entries.reduce((n, e) => { if (!Number.isSafeInteger(e.amountCents)) throw new Error('Ledger amount must be integer minor units'); return n + e.amountCents }, 0)
}
export function assertPayout(amountCents: unknown, owedCents: number) {
  if (!Number.isSafeInteger(amountCents) || (amountCents as number) < 1) throw new Error('Payout must be a positive amount')
  if ((amountCents as number) > owedCents) throw new Error('Payout exceeds the commission owed to this advisor')
  return amountCents as number
}

export const COMPONENT_KINDS = ['hotel', 'cruise', 'tour', 'flight', 'transfer', 'rail', 'insurance', 'activity', 'fee']
export const PAYMENT_MODELS = ['client_pays_supplier', 'agency_collects']
const money = (v: unknown, label: string) => { if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > 2147483647) throw new Error(`${label} must be a non-negative amount`); return v as number }
const date = (v: unknown, label: string) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error(`${label}: valid date required`)
  return new Date(`${v.slice(0, 10)}T12:00:00.000Z`)
}
/** A reservation entered directly (booked elsewhere, or quoted outside a proposal). */
export function componentEntry(input: any) {
  const title = requiredText(input.title, 'Title', 1, 160)
  if (!COMPONENT_KINDS.includes(input.kind)) throw new Error('Choose a component kind')
  const paymentModel = input.paymentModel || 'client_pays_supplier'
  if (!PAYMENT_MODELS.includes(paymentModel)) throw new Error('Choose who collects payment')
  const sellCents = money(input.sellCents, 'Sell price'), netCostCents = money(input.netCostCents ?? 0, 'Net cost')
  if (netCostCents > sellCents) throw new Error('Net cost cannot exceed the sell price')
  const commissionBps = input.commissionBps === undefined || input.commissionBps === null || input.commissionBps === '' ? 0 : Number(input.commissionBps)
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new Error('Commission must be 0 to 100 percent')
  const startAt = date(input.startAt, 'Start date'), endAt = date(input.endAt, 'End date')
  if (startAt && endAt && endAt < startAt) throw new Error('End date must not be before the start date')
  return { title, kind: input.kind as string, paymentModel, sellCents, netCostCents, commissionBps, startAt, endAt }
}

/** Booked supplier space must be cancelled one by one first (penalties and refunds); only quotes and holds are released with the trip. */
export function tripCancelPlan(components: { id: string; title: string; bookingStatus: string }[]) {
  const live = components.filter((c) => c.bookingStatus !== 'cancelled')
  return { blockers: live.filter((c) => ['booked', 'ticketed'].includes(c.bookingStatus)).map((c) => c.title), release: live.filter((c) => ['quoted', 'held'].includes(c.bookingStatus)).map((c) => c.id) }
}
