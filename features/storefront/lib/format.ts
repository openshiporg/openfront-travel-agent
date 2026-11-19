export const dollars = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100)
export const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')
export const words = (v?: string | null) => { const s = String(v || '').replace(/_/g, ' '); return s ? s[0].toUpperCase() + s.slice(1) : '' }

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
/** "United States · Cruise" from the destination's country code and specialty; the country is left out when it is the destination's own name. */
export function placeLine(d: { name: string; country?: string | null; specialty?: string | null }) {
  let country = d.country || ''
  if (/^[A-Z]{2}$/.test(country)) { try { country = regionNames.of(country) || country } catch {} }
  return [country && country.toLowerCase() !== d.name.toLowerCase() ? country : '', d.specialty].filter(Boolean).join(' · ')
}
