import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

/** Server-side read: explicit projection, throws a readable error. */
export async function query<T = any>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await keystoneClient<T>(document, variables)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export function money(cents: number | null | undefined, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents ?? 0) / 100)
}
export function day(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—'
}
export const label = (value?: string | null) => (value ? value.replace(/_/g, ' ') : '—')
