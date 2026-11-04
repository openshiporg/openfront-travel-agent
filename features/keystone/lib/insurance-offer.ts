export type InsuranceDecision = 'offered' | 'accepted' | 'declined'
export type InsuranceStatus = 'not_offered' | InsuranceDecision
export type InsuranceRecord = { travelerId: string; decision: string; recordedAt: string | Date; waiverNote?: string | null }
export const DECLINE_NOTE_MIN = 10
export const DECLINE_NOTE_MAX = 500

export const INSURANCE_TEXT: Record<InsuranceStatus, string> = {
  not_offered: 'Travel insurance not offered',
  offered: 'Insurance offered, no answer yet',
  accepted: 'Insurance accepted',
  declined: 'Insurance declined (waiver on file)',
}
export const insuranceNeedsAction = (s: InsuranceStatus) => s === 'not_offered' || s === 'offered'

/** The note that justifies a decline. Refuses empty or token notes so the record means something. */
export function parseWaiverNote(value: unknown): string {
  const note = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (note.length < DECLINE_NOTE_MIN) throw new Error(`Declined insurance needs a waiver note of at least ${DECLINE_NOTE_MIN} characters`)
  if (note.length > DECLINE_NOTE_MAX) throw new Error(`Waiver note must be ${DECLINE_NOTE_MAX} characters or fewer`)
  return note
}
export function parseDecision(value: unknown): InsuranceDecision {
  if (value === 'offered' || value === 'accepted' || value === 'declined') return value
  throw new Error('Choose offered, accepted or declined')
}
/**
 * The record is append-only (every answer is a new row), so the current answer is the latest row.
 * Ties on the timestamp resolve to the later position in the list, which is how rows are read (oldest first).
 */
export function currentInsurance(records: InsuranceRecord[], travelerId: string): { status: InsuranceStatus; recordedAt: string | null; waiverNote: string | null } {
  let best: InsuranceRecord | null = null
  for (const r of records) {
    if (r.travelerId !== travelerId) continue
    if (!best || new Date(r.recordedAt).getTime() >= new Date(best.recordedAt).getTime()) best = r
  }
  if (!best) return { status: 'not_offered', recordedAt: null, waiverNote: null }
  const status = (['offered', 'accepted', 'declined'].includes(best.decision) ? best.decision : 'not_offered') as InsuranceStatus
  return { status, recordedAt: new Date(best.recordedAt).toISOString(), waiverNote: status === 'declined' ? best.waiverNote || null : null }
}
/** Pre-departure check across all travelers: who still needs an answer. */
export function insuranceGaps(records: InsuranceRecord[], travelerIds: string[]) {
  const rows = travelerIds.map((id) => ({ id, ...currentInsurance(records, id) }))
  return { rows, open: rows.filter((r) => insuranceNeedsAction(r.status)), declined: rows.filter((r) => r.status === 'declined') }
}
