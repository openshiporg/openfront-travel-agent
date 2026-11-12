export type ComponentLike = { bookingStatus?: string | null; confirmationNumber?: string | null; startAt?: string | null }

/** A component the client expects to use that has no supplier confirmation yet. Derived, never stored. */
export function needsConfirmation(c: ComponentLike): boolean {
  if (!c.startAt || c.bookingStatus === 'cancelled') return false
  return !String(c.confirmationNumber || '').trim()
}

/** Whole days until travel (negative once it has started); null when there is no start date. */
export function daysUntilStart(c: ComponentLike, now = Date.now()): number | null {
  if (!c.startAt) return null
  const start = Date.parse(c.startAt)
  return Number.isFinite(start) ? Math.floor((start - now) / 86_400_000) : null
}

/** True once a supplier hold's expiry has passed; computed on read. */
export function holdLapsed(holdUntil: string | null | undefined, now = Date.now()): boolean {
  const t = holdUntil ? Date.parse(holdUntil) : NaN
  return Number.isFinite(t) && t < now
}

/** Plain wording for the alert: "starts in 5 days", "starts tomorrow", "already started". */
export function startsPhrase(c: ComponentLike, now = Date.now()): string {
  const d = daysUntilStart(c, now)
  if (d === null) return ''
  if (d < 0) return 'already started'
  if (d === 0) return 'starts today'
  if (d === 1) return 'starts tomorrow'
  return `starts in ${d} days`
}
