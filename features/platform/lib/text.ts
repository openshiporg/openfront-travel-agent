/** Joins the parts that exist with a separator; never prints undefined, null or blanks. */
export function joinParts(parts: unknown[], separator = ' · '): string {
  return parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== '' && String(p) !== 'undefined').map((p) => String(p).trim()).join(separator)
}

const fmtDay = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** "Apr 22, 2027 to May 6, 2027", a single side when only one date exists, or an empty string when neither does. */
export function dateRange(start?: string | null, end?: string | null): string {
  if (start && end) return `${fmtDay(start)} to ${fmtDay(end)}`
  if (start) return `From ${fmtDay(start)}`
  if (end) return `Until ${fmtDay(end)}`
  return ''
}
