/** Parses a decimal dollar string into integer cents; null when it is not a valid positive amount. */
export function toCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null
  const cents = Math.round(Number(value) * 100)
  return cents > 0 ? cents : null
}
