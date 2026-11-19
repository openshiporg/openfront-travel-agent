'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { acceptProposalAction } from '../actions'
import { dollars } from '../lib/format'

const total = (o: any) => o.items.reduce((n: number, i: any) => n + i.sellCents, 0)

export function ProposalChoice({ token, options, currency, status, depositBps = 0 }: { token: string; options: any[]; currency: string; status: string; depositBps?: number }) {
  const [optionId, setOptionId] = useState(options[0]?.id || '')
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(status === 'accepted'), [deposit, setDeposit] = useState<{ invoiceToken: string; number: string; paid: boolean } | null>(null)
  const chosen = options.find((o) => o.id === optionId)
  const depositCents = chosen ? Math.round(total(chosen) * depositBps / 10000) : 0
  if (!options.length) return <p className="text-sm text-slate-700">Your advisor has not added options to this proposal yet.</p>
  return (
    <div className="space-y-6">
      <RadioGroup value={optionId} onValueChange={setOptionId} className="gap-0 divide-y divide-slate-200 border-y border-slate-200" disabled={accepted} aria-label="Trip options">
        {options.map((o) => (
          <Label key={o.id} htmlFor={`o-${o.id}`} className="flex cursor-pointer items-start gap-3 py-4 has-[:disabled]:cursor-default">
            <RadioGroupItem id={`o-${o.id}`} value={o.id} className="mt-1" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 text-base font-semibold"><span>{o.title}</span><span>{dollars(total(o), currency)}</span></span>
              <span className="block space-y-1.5">
                {o.items.map((i: any) => (
                  <span key={i.id} className="flex justify-between gap-4 text-sm font-normal text-slate-700">
                    <span className="min-w-0">{i.title}{i.details ? <span className="block text-slate-600">{i.details}</span> : null}</span>
                    <span className="shrink-0">{dollars(i.sellCents, currency)}</span>
                  </span>
                ))}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      {accepted ? <div role="status" className="space-y-2 text-sm">
        <p className="text-base font-semibold">You accepted this proposal.</p>
        {deposit ? (deposit.paid ? <p>Your deposit {deposit.number} is paid.</p> : <p><a className="cta" href={`/invoice/${deposit.invoiceToken}`}>Pay the deposit ({deposit.number})</a></p>) : <p className="text-slate-700">Your advisor sends the invoice by email.</p>}
        <p><a className="link font-medium" href={`/trip/${token}`}>See your trip, itinerary and invoices</a></p>
      </div> : (
        <div className="max-w-md space-y-4">
          {depositCents > 0 ? <p className="text-sm text-slate-700">Accepting creates an invoice for a {depositBps / 100}% deposit of <span className="font-semibold text-slate-900">{dollars(depositCents, currency)}</span>. You can pay it on the next page.</p> : null}
          <div className="space-y-1.5"><Label htmlFor="who">Your full name, to accept</Label><Input id="who" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="name" /></div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <Button disabled={pending || !name.trim() || !optionId} onClick={() => { setError(null); start(async () => { const r = await acceptProposalAction(token, optionId, name); if (r.ok) { setAccepted(true); setDeposit(r.data?.deposit || null) } else setError(r.error) }) }}>{pending ? 'Saving…' : chosen ? `Accept ${chosen.title}` : 'Accept this option'}</Button>
        </div>
      )}
    </div>
  )
}
