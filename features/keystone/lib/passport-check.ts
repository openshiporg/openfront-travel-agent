export type PassportStatus = 'missing' | 'expired' | 'expires_before_return' | 'short_validity' | 'valid'
export const PASSPORT_VALIDITY_MONTHS = 6

const addMonths = (d: Date, n: number) => { const r = new Date(d.getTime()); r.setUTCMonth(r.getUTCMonth() + n); return r }

/**
 * Many destinations require the passport to be valid for six months after the return date.
 * Derived from the stored expiry and the trip dates (return falls back to departure, then today), never stored.
 */
export function passportStatus(expiresAt: Date | string | null | undefined, trip: { startDate?: Date | string | null; endDate?: Date | string | null }, now = new Date()): PassportStatus {
  if (!expiresAt) return 'missing'
  const exp = new Date(expiresAt)
  if (Number.isNaN(exp.getTime())) return 'missing'
  const ret = new Date(trip.endDate || trip.startDate || now)
  const ref = Number.isNaN(ret.getTime()) ? now : ret
  if (exp.getTime() < now.getTime()) return 'expired'
  if (exp.getTime() < ref.getTime()) return 'expires_before_return'
  if (exp.getTime() < addMonths(ref, PASSPORT_VALIDITY_MONTHS).getTime()) return 'short_validity'
  return 'valid'
}
export const passportNeedsAction = (s: PassportStatus) => s !== 'valid'
export const PASSPORT_TEXT: Record<PassportStatus, string> = {
  missing: 'Passport expiry not recorded',
  expired: 'Passport expired',
  expires_before_return: 'Passport expires before return',
  short_validity: 'Under 6 months valid after return',
  valid: 'Passport valid for trip',
}
/** Date typed in the advisor form: a real calendar day, stored at noon UTC; refuses nonsense and dates over 20 years out. */
export function parsePassportExpiry(value: unknown, now = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!m) throw new Error('Passport expiry must be a date')
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) throw new Error('Passport expiry must be a real date')
  if (d.getUTCFullYear() < 1990 || d.getTime() > addMonths(now, 240).getTime()) throw new Error('Passport expiry is out of range')
  return d
}
