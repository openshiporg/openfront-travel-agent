'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { submitInquiryAction } from '../actions'

const TYPES: [string, string][] = [['family', 'Family'], ['honeymoon', 'Honeymoon'], ['group', 'Group'], ['corporate', 'Corporate'], ['cruise', 'Cruise'], ['adventure', 'Adventure']]

export function InquiryForm({ destination = '', travelers = 2 }: { destination?: string; travelers?: number }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [tripType, setTripType] = useState('family')
  const [from, setFrom] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  if (sent) return (
    <div role="status" className="space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-lg font-semibold">We have your request</h2>
      <p className="text-sm text-slate-700">An advisor will write to {sent} with trip options and prices. Nothing is booked or charged until you accept one.</p>
      <p><Link href="/destinations" className="link text-sm font-medium">Back to destinations</Link></p>
    </div>
  )
  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const email = String(f.get('email') || '')
        const r = await submitInquiryAction({ name: f.get('name'), email, phone: f.get('phone'), destinations: f.get('destinations'), tripType, partySize: Number(f.get('partySize') || 1), budgetCents: Math.round(Number(f.get('budget') || 0) * 100), travelWindowStart: f.get('from') || null, travelWindowEnd: f.get('to') || null })
        if (r.ok) setSent(email); else setError(r.error)
      })
    }}>
      <div className="space-y-1.5"><Label htmlFor="destinations">Where do you want to go?</Label><Textarea id="destinations" name="destinations" defaultValue={destination} maxLength={2000} rows={3} required /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="from">Earliest departure</Label><Input id="from" name="from" type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="to">Latest return</Label><Input id="to" name="to" type="date" min={from || today} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="tripType">Trip type</Label>
          <Select value={tripType} onValueChange={setTripType}><SelectTrigger id="tripType" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="partySize">Travelers</Label><Input id="partySize" name="partySize" type="number" inputMode="numeric" min={1} max={99} defaultValue={travelers} /></div>
        <div className="space-y-1.5"><Label htmlFor="budget">Total budget in USD</Label><Input id="budget" name="budget" type="number" inputMode="numeric" min={0} step={100} aria-describedby="budget-help" /></div>
      </div>
      <p id="budget-help" className="-mt-2 text-sm text-slate-600">Dates and budget are optional. They help the advisor send options that fit.</p>
      <h2 className="border-t border-slate-200 pt-5 text-lg font-semibold">How we reach you</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" name="name" autoComplete="name" required maxLength={200} /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={80} /></div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send to an advisor'}</Button>
    </form>
  )
}
