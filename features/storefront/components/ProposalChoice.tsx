'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { acceptProposalAction } from '../actions'
import { dollars } from '../lib/format'

export function ProposalChoice({ token, options, currency, status, depositBps = 0 }: { token: string; options: any[]; currency: string; status: string; depositBps?: number }) {
  const [optionId, setOptionId] = useState(options[0]?.id || '')
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(status === 'accepted'), [deposit, setDeposit] = useState<{ invoiceToken: string; number: string; paid: boolean } | null>(null)
  const chosen = options.find((o) => o.id === optionId)
  const depositCents = chosen ? Math.round(chosen.items.reduce((n: number, i: any) => n + i.sellCents, 0) * depositBps / 10000) : 0
  return (
    <div className="space-y-4">
      <RadioGroup value={optionId} onValueChange={setOptionId} className="space-y-3" disabled={accepted}>
        {options.map((o) => (
          <Label key={o.id} htmlFor={`o-${o.id}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <RadioGroupItem id={`o-${o.id}`} value={o.id} className="mt-1" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-medium">{o.title} · {dollars(o.items.reduce((n: number, i: any) => n + i.sellCents, 0), currency)}</span>
              {o.items.map((i: any) => <span key={i.id} className="block text-sm font-normal text-muted-foreground">{i.title} · {dollars(i.sellCents, currency)}</span>)}
            </span>
          </Label>
        ))}
      </RadioGroup>
      {accepted ? <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
        <p>Proposal accepted. <a className="underline" href={`/trip/${token}`}>View your trip, itinerary and invoices</a>.</p>
        {deposit ? (deposit.paid ? <p>Your deposit {deposit.number} is paid.</p> : <p><a className="font-medium underline" href={`/invoice/${deposit.invoiceToken}`}>Pay your deposit ({deposit.number})</a> to confirm your booking.</p>) : <p>Your advisor will send the invoice.</p>}
      </div> : (
        <>
          {depositCents > 0 ? <p className="text-sm">A deposit of <span className="font-medium">{dollars(depositCents, currency)}</span> ({depositBps / 100}%) is invoiced when you accept. You can pay it right after.</p> : null}
          <div className="space-y-1"><Label htmlFor="who">Full name</Label><Input id="who" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></div>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <Button disabled={pending || !name.trim() || !optionId} onClick={() => { setError(null); start(async () => { const r = await acceptProposalAction(token, optionId, name); if (r.ok) { setAccepted(true); setDeposit(r.data?.deposit || null) } else setError(r.error) }) }}>{pending ? 'Saving' : 'Accept this option'}</Button>
        </>
      )}
    </div>
  )
}
