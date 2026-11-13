'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupBookingAction } from '../actions'
import { dollars } from '../lib/format'

export function LookupForm() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [trip, setTrip] = useState<any>(null)
  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setError(null); setTrip(null)
        start(async () => { const r = await lookupBookingAction(String(f.get('email')), String(f.get('code'))); if (r.ok) setTrip(r.data); else setError(r.error) })
      }}>
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <div className="space-y-1"><Label htmlFor="code">Trip or invoice code</Label><Input id="code" name="code" required placeholder="TR-…" /></div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'Looking up' : 'Find booking'}</Button>
      </form>
      {trip ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium">{trip.title}</p>
          <p className="font-mono text-xs uppercase tracking-wide">{trip.tripNumber} · {String(trip.status).replace(/_/g, ' ')}</p>
          <ul>{trip.invoices.map((i: any) => <li key={i.number} className="flex justify-between gap-3"><span className="font-mono">{i.number} · {String(i.status).replace(/_/g, ' ')}</span><span>{dollars(i.collectedCents, i.currencyCode)} of {dollars(i.totalCents, i.currencyCode)}{i.refundedCents > 0 ? ` · ${dollars(i.refundedCents, i.currencyCode)} refunded` : ''}</span></li>)}</ul>
        </div>
      ) : null}
    </div>
  )
}
