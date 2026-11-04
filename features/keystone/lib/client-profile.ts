export type Celebration = { label: string; date: string | null }
export type TravelProfile = { seat: string; room: string; dietary: string; notes: string; celebrations: Celebration[] }
export const EMPTY_PROFILE: TravelProfile = { seat: '', room: '', dietary: '', notes: '', celebrations: [] }
const LIMITS = { seat: 120, room: 120, dietary: 200, notes: 500 } as const

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
/** Loyalty numbers are write-only like passports; nothing here may log them. */
export const LOYALTY_PROGRAM_MAX = 60
export const LOYALTY_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{2,29}$/

export function parseProfile(input: any): TravelProfile {
  const out: any = { ...EMPTY_PROFILE }
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = clean(input?.[k]); if (v.length > LIMITS[k]) throw new Error(`${k[0].toUpperCase()}${k.slice(1)} is too long (${LIMITS[k]} characters maximum)`)
    out[k] = v
  }
  const raw = Array.isArray(input?.celebrations) ? input.celebrations : []
  if (raw.length > 10) throw new Error('At most 10 celebrations')
  out.celebrations = raw.map((c: any) => {
    const label = clean(c?.label); if (!label || label.length > 80) throw new Error('Each celebration needs a label (80 characters maximum)')
    const date = c?.date ? String(c.date).slice(0, 10) : null
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) throw new Error('Celebration date must be a real date')
    return { label, date }
  })
  return out
}
/** Stored profile -> safe shape; tolerates null and old/odd JSON. */
export function readProfile(stored: unknown): TravelProfile {
  try { return parseProfile(stored && typeof stored === 'object' ? stored : {}) } catch { return { ...EMPTY_PROFILE } }
}
export const profileIsEmpty = (p: TravelProfile) => !p.seat && !p.room && !p.dietary && !p.notes && !p.celebrations.length

/**
 * Merge one loyalty change into the stored {program: number} map. A blank number removes the program.
 * Returns the new map plus the program name and action, never a number.
 */
export function applyLoyalty(stored: unknown, program: unknown, number: unknown) {
  const name = clean(program)
  if (!name) throw new Error('Loyalty program name required')
  if (name.length > LOYALTY_PROGRAM_MAX) throw new Error('Loyalty program name is too long')
  const map: Record<string, string> = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...(stored as any) } : {}
  const n = clean(number)
  if (!n) { delete map[name]; return { map, program: name, action: 'removed' as const } }
  if (!LOYALTY_NUMBER_RE.test(n)) throw new Error('Loyalty number must be 3 to 30 letters, digits, spaces or dashes')
  const had = Object.prototype.hasOwnProperty.call(map, name)
  map[name] = n
  return { map, program: name, action: had ? ('updated' as const) : ('added' as const) }
}
export const loyaltyPrograms = (stored: unknown): string[] => stored && typeof stored === 'object' && !Array.isArray(stored) ? Object.keys(stored as any).sort() : []
