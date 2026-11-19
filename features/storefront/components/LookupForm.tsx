'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupBookingAction } from '../actions'
import { dollars, date, words } from '../lib/format'

export function LookupForm() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [trip, setTrip] = useState<any>(null)
  const when = trip ? [date(trip.startDate), date(trip.endDate)].filter(Boolean).join(' to ') : ''
  return (
    <div className="space-y-8">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setError(null); setTrip(null)
        start(async () => { const r = await lookupBookingAction(String(f.get('email')), String(f.get('code'))); if (r.ok) setTrip(r.data); else setError(r.error === 'Booking not found' ? 'No booking matches that email and code. Check both and try again.' : r.error) })
      }}>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-1.5"><Label htmlFor="code">Trip or invoice code</Label><Input id="code" name="code" required autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="code-help" /><p id="code-help" className="text-sm text-slate-600">Starts with TR- or INV-.</p></div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'Looking…' : 'Find booking'}</Button>
      </form>
      {trip ? (
        <section aria-live="polite" className="space-y-3 border-t border-slate-200 pt-6">
          <h2 className="text-xl font-bold tracking-tight">{trip.title}</h2>
          <p className="text-sm text-slate-700">{[`Trip code ${trip.tripNumber}`, when, words(trip.status)].filter(Boolean).join(' · ')}</p>
          {trip.invoices.length ? (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
              {trip.invoices.map((i: any) => (
                <li key={i.number} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
                  <span><span className="font-medium">{i.number}</span> · {words(i.status)}</span>
                  <span>{dollars(i.collectedCents, i.currencyCode)} of {dollars(i.totalCents, i.currencyCode)} paid{i.refundedCents > 0 ? ` · ${dollars(i.refundedCents, i.currencyCode)} refunded` : ''}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-700">No invoices yet.</p>}
          <p className="text-sm text-slate-600">To pay or see the itinerary, open the trip link your advisor emailed you.</p>
        </section>
      ) : null}
    </div>
  )
}
