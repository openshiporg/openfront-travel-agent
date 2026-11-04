export type SupplierDueInput = {
  paymentModel?: string | null
  bookingStatus?: string | null
  netCostCents?: number | null
  startAt?: string | null
  supplierDueAt?: string | null
  cancelPenaltySchedule?: unknown
  supplierPayments?: { amountCents: number }[]
}
export type SupplierDue = { dueAt: string | null; source: 'set' | 'cancellation' | null; remainingCents: number; overdue: boolean; daysLate: number }

const DAY = 86_400_000
const OWED = ['booked', 'ticketed']

/** Day the supplier's first cancellation penalty begins: travel start minus the earliest cutoff in the schedule. */
export function penaltyStartsAt(startAt?: string | null, schedule?: unknown): string | null {
  if (!startAt || !Array.isArray(schedule)) return null
  const start = Date.parse(startAt)
  const cutoffs = schedule.map((r: any) => Number(r?.daysBefore)).filter((n) => Number.isFinite(n) && n > 0)
  if (!Number.isFinite(start) || !cutoffs.length) return null
  return new Date(start - Math.max(...cutoffs) * DAY).toISOString()
}

/**
 * What the agency still owes this supplier and by when. Only agency-collected, confirmed bookings create the obligation
 * (when the client pays the supplier directly there is nothing for the agency to pay). The due date is the one the advisor set;
 * without one it is the day the cancellation penalties begin, because paying after that day puts the booking at risk. Derived, never stored.
 */
export function supplierDue(c: SupplierDueInput, now = Date.now()): SupplierDue {
  const none: SupplierDue = { dueAt: null, source: null, remainingCents: 0, overdue: false, daysLate: 0 }
  if (c.paymentModel !== 'agency_collects' || !OWED.includes(String(c.bookingStatus))) return none
  const paid = (c.supplierPayments || []).reduce((n, p) => n + (p.amountCents || 0), 0)
  const remainingCents = Math.max((c.netCostCents || 0) - paid, 0)
  if (remainingCents === 0) return none
  const set = c.supplierDueAt || null
  const derived = set ? null : penaltyStartsAt(c.startAt, c.cancelPenaltySchedule)
  const dueAt = set || derived
  if (!dueAt) return { ...none, remainingCents }
  // Deadlines are calendar days: due today is not late yet, and lateness counts whole UTC calendar days.
  const t = Date.parse(dueAt)
  const late = Number.isFinite(t) ? Math.floor(now / DAY) - Math.floor(t / DAY) : 0
  return { dueAt, source: set ? 'set' : 'cancellation', remainingCents, overdue: late > 0, daysLate: Math.max(late, 0) }
}
