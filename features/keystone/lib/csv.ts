/**
 * Spreadsheet-safe CSV. Any text cell that a spreadsheet could read as a formula (leading = + - @ tab or CR, also after
 * whitespace) gets a leading apostrophe; every cell is quoted with doubled quotes; line breaks inside cells become spaces.
 * Numbers are written as plain decimals and never touched by the formula guard.
 */
/** A pre-formatted number (e.g. "-12.50"). Only produced by `centsDecimal`, so it is never attacker text and skips the formula guard. */
export type Num = { readonly num: string }
export function csvCell(value: unknown): string {
  if (value && typeof value === 'object' && typeof (value as Num).num === 'string' && /^-?\d+(\.\d+)?$/.test((value as Num).num)) return (value as Num).num
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let s = value == null ? '' : String(value).replace(/[\r\n]+/g, ' ')
  if (/^\s*[=+\-@\t]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
export const csvLine = (cells: unknown[]) => cells.map(csvCell).join(',')
export const toCsv = (header: string[], rows: unknown[][]) => [csvLine(header), ...rows.map(csvLine)].join('\r\n') + '\r\n'
/** Integer cents as a plain decimal number cell, e.g. -1250 -> -12.50. */
export const centsDecimal = (cents: number): Num => { const n = Math.round(cents), a = Math.abs(n); return { num: `${n < 0 ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}` } }
