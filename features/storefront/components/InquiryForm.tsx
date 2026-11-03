'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { submitInquiryAction } from '../actions'

const TYPES = ['honeymoon', 'family', 'group', 'corporate', 'cruise', 'adventure']

export function InquiryForm({ destination = '' }: { destination?: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [tripType, setTripType] = useState('family')
  if (sent) return <p role="status" className="rounded-md border p-4 text-sm">Inquiry received. An advisor will contact you by email.</p>
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      const f = new FormData(e.currentTarget)
      setError(null)
      start(async () => {
        const r = await submitInquiryAction({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), destinations: f.get('destinations'), tripType, partySize: Number(f.get('partySize') || 1), budgetCents: Math.round(Number(f.get('budget') || 0) * 100) })
        if (r.ok) setSent(true); else setError(r.error)
      })
    }}>
      <div className="space-y-1"><Label htmlFor="name">Name</Label><Input id="name" name="name" required maxLength={200} /></div>
      <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
      <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
      <div className="space-y-1"><Label>Trip type</Label>
        <Select value={tripType} onValueChange={setTripType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="space-y-1"><Label htmlFor="destinations">Destinations</Label><Textarea id="destinations" name="destinations" defaultValue={destination} maxLength={2000} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="partySize">Travelers</Label><Input id="partySize" name="partySize" type="number" min={1} defaultValue={2} /></div>
        <div className="space-y-1"><Label htmlFor="budget">Budget (USD)</Label><Input id="budget" name="budget" type="number" min={0} /></div>
      </div>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Sending' : 'Send inquiry'}</Button>
    </form>
  )
}
