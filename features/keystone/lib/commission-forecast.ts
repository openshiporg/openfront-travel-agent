export type ForecastComponent = {
  id: string
  title: string
  bookingStatus: string
  commissionStatus: string
  commissionCents: number
  currencyCode: string
  startAt?: string | Date | null
  endAt?: string | Date | null
  supplier?: { id: string; name: string; commissionPaymentTermsDays?: number | null } | null
  trip?: { title?: string | null } | null
  allocations?: { amountCents: number }[]
}
export type ForecastRow = { key: string; label: string; currencyCode: string; expectedCents: number; receivedCents: number; outstandingCents: number; overdueCents: number; count: number }
export type Receivable = { id: string; title: string; trip: string; supplier: string; currencyCode: string; outstandingCents: number; dueAt: string; daysLate: number }
export type Forecast = { bySupplier: ForecastRow[]; byMonth: ForecastRow[]; overdue: Receivable[]; excluded: number }

const DAY = 86_400_000
/** Only confirmed bookings are forecast; quotes, holds and cancellations are not income yet. */
export const FORECAST_BOOKING = ['booked', 'ticketed']
const iso = (v: string | Date) => new Date(v).toISOString()

/** The supplier owes commission `commissionPaymentTermsDays` after the component ends (start if no end). Unknown dates give null. */
export function receivableDueAt(c: ForecastComponent): string | null {
  const base = c.endAt || c.startAt
  if (!base || Number.isNaN(new Date(base).getTime())) return null
  return iso(new Date(new Date(base).getTime() + (c.supplier?.commissionPaymentTermsDays ?? 30) * DAY))
}
export const monthKey = (isoDate: string) => isoDate.slice(0, 7)

/**
 * Expected vs received commission per supplier and per month (month = when it is due), with overdue receivables.
 * Received is what receipts were allocated to the component; written-off commission is out of the forecast; components
 * without a date are in the supplier totals under "No date" for months and never flagged overdue.
 */
export function commissionForecast(components: ForecastComponent[], now = Date.now()): Forecast {
  const sup = new Map<string, ForecastRow>(), mon = new Map<string, ForecastRow>(), overdue: Receivable[] = []
  let excluded = 0
  const add = (m: Map<string, ForecastRow>, key: string, label: string, c: ForecastComponent, expected: number, received: number, late: number) => {
    const k = `${key}|${c.currencyCode}`, r = m.get(k) || { key, label, currencyCode: c.currencyCode, expectedCents: 0, receivedCents: 0, outstandingCents: 0, overdueCents: 0, count: 0 }
    r.expectedCents += expected; r.receivedCents += received; r.outstandingCents += Math.max(expected - received, 0); r.overdueCents += late; r.count += 1; m.set(k, r)
  }
  for (const c of components) {
    if (!FORECAST_BOOKING.includes(c.bookingStatus) || c.commissionStatus === 'written_off' || !(c.commissionCents > 0)) { excluded++; continue }
    const received = (c.allocations || []).reduce((n, a) => n + a.amountCents, 0)
    const outstanding = Math.max(c.commissionCents - received, 0)
    const dueAt = receivableDueAt(c)
    const lateDays = dueAt && outstanding > 0 ? Math.floor(now / DAY) - Math.floor(Date.parse(dueAt) / DAY) : 0
    const late = lateDays > 0 ? outstanding : 0
    if (late) overdue.push({ id: c.id, title: c.title, trip: c.trip?.title || '', supplier: c.supplier?.name || 'No supplier', currencyCode: c.currencyCode, outstandingCents: outstanding, dueAt: dueAt!, daysLate: lateDays })
    add(sup, c.supplier?.id || 'none', c.supplier?.name || 'No supplier', c, c.commissionCents, received, late)
    add(mon, dueAt ? monthKey(dueAt) : 'none', dueAt ? monthKey(dueAt) : 'No date', c, c.commissionCents, received, late)
  }
  const byLabel = (a: ForecastRow, b: ForecastRow) => a.label.localeCompare(b.label) || a.currencyCode.localeCompare(b.currencyCode)
  const byMonth = [...mon.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.key.localeCompare(b.key)) || a.currencyCode.localeCompare(b.currencyCode))
  return { bySupplier: [...sup.values()].sort(byLabel), byMonth, overdue: overdue.sort((a, b) => b.daysLate - a.daysLate || a.title.localeCompare(b.title)), excluded }
}
