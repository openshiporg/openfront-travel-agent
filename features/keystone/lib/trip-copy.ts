const DAY = 86400000

/** Whole-day shift (UTC) that moves a trip starting on `from` to start on `to`; zero when either is unknown. */
export function dayShift(from: Date | null | undefined, to: Date | null | undefined) {
  if (!from || !to) return 0
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((b - a) / DAY)
}
export function shiftDate(value: Date | null | undefined, days: number) {
  return value ? new Date(value.getTime() + days * DAY) : null
}
